// Peças compartilhadas entre as rotas: auditoria, cookies, sessão e tempo real.
import { sha256, gerarToken } from './seguranca.js';

export const COOKIE_SESSAO = 'farol_sessao';

// ---------- Tempo real ----------
export class HubTempoReal {
  constructor() { this.conexoes = new Set(); }
  adicionar(socket) {
    this.conexoes.add(socket);
    socket.on('close', () => this.conexoes.delete(socket));
  }
  emitir(tipo, dados) {
    const msg = JSON.stringify({ tipo, dados, ts: Date.now() });
    for (const s of this.conexoes) {
      if (s.readyState === 1) s.send(msg);
    }
  }
}

// ---------- Auditoria ----------
export function auditar(db, { usuario = null, acao, alvo = null, detalhes = null, ip = null }) {
  db.prepare('INSERT INTO auditoria (ts, usuario, acao, alvo, detalhes, ip) VALUES (?, ?, ?, ?, ?, ?)')
    .run(Date.now(), usuario, acao, alvo == null ? null : String(alvo),
      detalhes == null ? null : (typeof detalhes === 'string' ? detalhes : JSON.stringify(detalhes)), ip);
}

// ---------- Cookies ----------
export function lerCookies(cabecalho = '') {
  const cookies = {};
  for (const parte of String(cabecalho).split(';')) {
    const i = parte.indexOf('=');
    if (i < 0) continue;
    const nome = parte.slice(0, i).trim();
    if (nome) cookies[nome] = decodeURIComponent(parte.slice(i + 1).trim());
  }
  return cookies;
}

export function montarCookie(nome, valor, { maxAge, seguro }) {
  const partes = [`${nome}=${encodeURIComponent(valor)}`, 'Path=/', 'HttpOnly', 'SameSite=Strict', `Max-Age=${maxAge}`];
  if (seguro) partes.push('Secure');
  return partes.join('; ');
}

// ---------- Sessões ----------
export function criarSessao(ctx, usuarioId, ip) {
  const token = gerarToken();
  const agora = Date.now();
  const duracao = ctx.config.sessaoHoras * 3600_000;
  ctx.db.prepare('INSERT INTO sessoes (usuario_id, token_hash, criado_em, expira_em, ip) VALUES (?, ?, ?, ?, ?)')
    .run(usuarioId, sha256(token), agora, agora + duracao, ip);
  return { token, maxAge: Math.floor(duracao / 1000) };
}

export function obterSessao(ctx, req) {
  const token = lerCookies(req.headers.cookie)[COOKIE_SESSAO];
  if (!token || token.length > 200) return null;
  return ctx.db.prepare(`SELECT s.id, s.usuario_id, s.expira_em, s.elevado_ate, u.usuario, u.totp_ativo
      FROM sessoes s JOIN usuarios u ON u.id = s.usuario_id
      WHERE s.token_hash = ? AND s.expira_em > ?`).get(sha256(token), Date.now()) ?? null;
}

/** preHandler: exige sessão válida. */
export function exigirLogin(ctx) {
  return async (req, reply) => {
    const sessao = obterSessao(ctx, req);
    if (!sessao) return reply.code(401).send({ erro: 'Sessão inválida ou expirada' });
    req.sessao = sessao;
  };
}

/** preHandler: exige 2FA ativo e modo elevado (reconfirmação TOTP recente). */
export function exigirElevado() {
  return async (req, reply) => {
    if (!req.sessao?.totp_ativo) {
      return reply.code(403).send({ erro: 'Ative o 2FA em Configurações para executar scripts', precisa2fa: true });
    }
    if (req.sessao.elevado_ate <= Date.now()) {
      return reply.code(403).send({ erro: 'Confirme o código 2FA para continuar', precisaElevar: true });
    }
  };
}

export const MAX_SAIDA = 64 * 1024;
export function truncar(texto, limite = MAX_SAIDA) {
  const s = String(texto ?? '');
  const buf = Buffer.from(s, 'utf8');
  if (buf.length <= limite) return s;
  return buf.subarray(0, limite).toString('utf8').replace(/�$/, '') + '\n[... saída truncada em 64 KB]';
}
