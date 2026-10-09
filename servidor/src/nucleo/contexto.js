// O `ctx` entregue a todos os módulos. Tudo o que um módulo precisa do núcleo passa por aqui.
import { RegistroPermissoes } from './permissoes.js';
import { obterSessao } from './sessao.js';
import { HubPainel, CanalAgentes } from './tempo-real.js';
import { Comandos } from './comandos.js';
import { Relay } from './relay.js';
import { ResolvedorAlvos } from './alvos.js';
import { Agendador } from './agendador.js';
import { sha256, iguaisSeguro } from '../seguranca.js';

export const VERSAO = '2.0.0';

export function auditar(db, { usuario = null, acao, alvo = null, detalhes = null, ip = null, agente_id = null }) {
  db.prepare('INSERT INTO auditoria (ts, usuario, acao, alvo, detalhes, ip, agente_id) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(Date.now(), usuario, acao, alvo == null ? null : String(alvo).slice(0, 2000),
      detalhes == null ? null : (typeof detalhes === 'string' ? detalhes : JSON.stringify(detalhes)).slice(0, 8000), ip, agente_id);
}

/** Chave de rate limit das rotas do agente: por agente (não por IP — vários agentes atrás do mesmo NAT). */
export function chaveLimiteAgente(req) {
  const m = /^Bearer ([0-9a-f-]{36}):/.exec(req.headers.authorization || '');
  return m ? `agente:${m[1]}` : `ip:${req.ip}`;
}

export function criarContexto({ db, config, log }) {
  const ctx = {
    db, config, log, versao: VERSAO,
    permissoes: new RegistroPermissoes(),
    /** APIs que os módulos expõem uns aos outros: ctx.servicos.alertas.abrir(...) */
    servicos: {},
    modulos: [],
    ganchos: { aoCheckin: [], tarefasAgente: [] },
  };

  // ---------- auditoria ----------
  ctx.auditar = (dados) => auditar(db, dados);
  /** Atalho dentro de rotas: usa o usuário da sessão e o IP da requisição. */
  ctx.auditarReq = (req, acao, { alvo = null, detalhes = null, agente_id = null } = {}) =>
    auditar(db, { usuario: req.sessao?.usuario ?? null, acao, alvo, detalhes, ip: req.ip, agente_id });

  // ---------- tempo real ----------
  ctx.hubPainel = new HubPainel(ctx);
  ctx.emitir = (tipo, dados, opcoes) => ctx.hubPainel.emitir(tipo, dados, opcoes);
  ctx.canalAgentes = new CanalAgentes(ctx);
  ctx.comandos = new Comandos(ctx);
  ctx.relay = new Relay(ctx);
  ctx.alvos = new ResolvedorAlvos(ctx);
  ctx.agendador = new Agendador(ctx);

  // ---------- segurança (preHandlers do Fastify) ----------
  ctx.temPermissao = (sessao, perm) => !!sessao && ctx.permissoes.papelTem(sessao.papel, perm);

  ctx.exigirLogin = async (req, reply) => {
    const sessao = obterSessao(ctx, req);
    if (!sessao) return reply.code(401).send({ erro: 'Sessão inválida ou expirada' });
    req.sessao = sessao;
  };

  /** Login + todas as permissões listadas. */
  ctx.exigirPermissao = (...perms) => {
    for (const p of perms) if (!ctx.permissoes.existe(p)) log?.warn?.(`permissão "${p}" usada mas não declarada por nenhum módulo`);
    return async (req, reply) => {
      if (!req.sessao) {
        const sessao = obterSessao(ctx, req);
        if (!sessao) return reply.code(401).send({ erro: 'Sessão inválida ou expirada' });
        req.sessao = sessao;
      }
      const falta = perms.find((p) => !ctx.permissoes.papelTem(req.sessao.papel, p));
      if (falta) return reply.code(403).send({ erro: 'Seu papel não permite esta ação', permissao: falta });
    };
  };

  /** 2FA ativo + modo elevado recente (reconfirmação TOTP). Use depois de exigirLogin/exigirPermissao. */
  ctx.exigirElevado = () => async (req, reply) => {
    if (!req.sessao) return reply.code(401).send({ erro: 'Sessão inválida ou expirada' });
    if (!req.sessao.totp_ativo) {
      return reply.code(403).send({ erro: 'Ative o 2FA em Configurações para executar ações remotas', precisa2fa: true });
    }
    if (req.sessao.elevado_ate <= Date.now()) {
      return reply.code(403).send({ erro: 'Confirme o código 2FA para continuar', precisaElevar: true });
    }
  };

  /**
   * Atalho para o preHandler de uma rota do painel:
   *   ctx.exigir()                                → só login
   *   ctx.exigir('alertas.ver')                   → login + permissão
   *   ctx.exigir('scripts.executar', { elevado: true }) → + 2FA/modo elevado
   */
  ctx.exigir = (perm = null, { elevado = false } = {}) => {
    const lista = [perm ? ctx.exigirPermissao(...[].concat(perm)) : ctx.exigirLogin];
    if (elevado) lista.push(ctx.exigirElevado());
    return lista;
  };

  /** preHandler das rotas do agente: "Authorization: Bearer <id>:<segredo>". Põe a linha do agente em req.agente. */
  ctx.autenticarAgente = async (req, reply) => {
    const m = /^Bearer ([0-9a-f-]{36}):([A-Za-z0-9_-]{20,128})$/.exec(req.headers.authorization || '');
    const agente = m ? db.prepare('SELECT * FROM agentes WHERE id = ?').get(m[1]) : null;
    if (!agente || agente.revogado || !iguaisSeguro(sha256(m[2]), agente.segredo_hash)) {
      return reply.code(401).send({ erro: 'Agente não autorizado' });
    }
    req.agente = agente;
  };

  /** Config de rate limit para rotas do agente (por agente, não por IP). */
  ctx.limiteAgente = (max = config.limites.agente) => ({ rateLimit: { max, timeWindow: '1 minute', keyGenerator: chaveLimiteAgente } });

  return ctx;
}
