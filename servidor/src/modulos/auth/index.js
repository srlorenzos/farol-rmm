// Autenticação e usuários: setup inicial, login com bloqueio progressivo, 2FA TOTP, modo elevado e gestão de usuários (RBAC).
import {
  hashSenha, verificarSenha, gastarTempoComoSenha, verificarTotp, novoSegredoTotp, uriOtpauth, sha256,
} from '../../seguranca.js';
import { criarSessao, obterSessao, montarCookie, lerCookies, COOKIE_SESSAO } from '../../nucleo/sessao.js';
import { PAPEIS } from '../../nucleo/permissoes.js';
import { PARAMS_ID } from '../../nucleo/util.js';

export const MAX_FALHAS = 5;
export const MINUTOS_ELEVADO = 10;

const usuarioSchema = { type: 'string', minLength: 3, maxLength: 64, pattern: '^[A-Za-z0-9._@-]+$' };
const senhaSchema = { type: 'string', minLength: 10, maxLength: 256 };
const codigoSchema = { type: 'string', pattern: '^[0-9]{6}$' };
const papelSchema = { type: 'string', enum: Object.keys(PAPEIS) };

export function validarSenhaForte(senha) {
  if (senha.length < 10) return 'A senha precisa de pelo menos 10 caracteres';
  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((r) => r.test(senha)).length;
  if (classes < 3) return 'Use pelo menos 3 tipos: minúsculas, maiúsculas, números, símbolos';
  return null;
}

export async function criarUsuario(db, usuario, senha, { papel = 'admin', nome = null } = {}) {
  const hash = await hashSenha(senha);
  const r = db.prepare('INSERT INTO usuarios (usuario, senha_hash, criado_em, papel, nome) VALUES (?, ?, ?, ?, ?)')
    .run(usuario, hash, Date.now(), papel, nome);
  return Number(r.lastInsertRowid);
}

export function totalUsuarios(db) {
  return db.prepare('SELECT COUNT(*) AS n FROM usuarios').get().n;
}

function registrarFalha(db, u) {
  if (!u) return;
  const falhas = u.falhas + 1;
  let bloqueado = 0;
  if (falhas >= MAX_FALHAS) {
    // Bloqueio progressivo: 1, 2, 4, 8... minutos (máx. 60).
    const minutos = Math.min(60, 2 ** (falhas - MAX_FALHAS));
    bloqueado = Date.now() + minutos * 60_000;
  }
  db.prepare('UPDATE usuarios SET falhas = ?, bloqueado_ate = ? WHERE id = ?').run(falhas, bloqueado, u.id);
}

const adminsAtivos = (db) => db.prepare("SELECT COUNT(*) AS n FROM usuarios WHERE papel = 'admin' AND ativo = 1").get().n;

export default {
  nome: 'auth',
  descricao: 'Login, 2FA, modo elevado e usuários',
  permissoes: {
    'usuarios.gerenciar': { descricao: 'Criar, alterar e desativar usuários' },
  },

  rotas(app, ctx) {
    const { db, config } = ctx;
    const limiteLogin = { rateLimit: { max: config.limites.login, timeWindow: '1 minute' } };
    const definirCookie = (reply, token, maxAge) => reply.header('set-cookie', montarCookie(COOKIE_SESSAO, token, { maxAge, seguro: config.https }));

    app.get('/api/estado', async (req) => {
      const s = obterSessao(ctx, req);
      return {
        precisaSetup: totalUsuarios(db) === 0,
        autenticado: !!s,
        usuario: s?.usuario ?? null,
        nome: s?.nome ?? null,
        papel: s?.papel ?? null,
        permissoes: s ? ctx.permissoes.doPapel(s.papel) : [],
        totpAtivo: !!s?.totp_ativo,
        elevadoAte: s?.elevado_ate ?? 0,
        agora: Date.now(),
        versao: ctx.versao,
      };
    });

    app.post('/api/setup', {
      config: limiteLogin,
      schema: { body: { type: 'object', required: ['usuario', 'senha'], additionalProperties: false,
        properties: { usuario: usuarioSchema, senha: senhaSchema } } },
    }, async (req, reply) => {
      if (totalUsuarios(db) > 0) return reply.code(409).send({ erro: 'O administrador já foi criado' });
      const fraca = validarSenhaForte(req.body.senha);
      if (fraca) return reply.code(400).send({ erro: fraca });
      const id = await criarUsuario(db, req.body.usuario, req.body.senha);
      ctx.auditar({ usuario: req.body.usuario, acao: 'admin_criado', alvo: req.body.usuario, ip: req.ip });
      const { token, maxAge } = criarSessao(ctx, id, req.ip);
      definirCookie(reply, token, maxAge);
      return { ok: true, usuario: req.body.usuario };
    });

    app.post('/api/login', {
      config: limiteLogin,
      schema: { body: { type: 'object', required: ['usuario', 'senha'], additionalProperties: false,
        properties: { usuario: { type: 'string', maxLength: 64 }, senha: { type: 'string', maxLength: 256 },
          codigo: { type: 'string', maxLength: 6 } } } },
    }, async (req, reply) => {
      const { usuario, senha, codigo } = req.body;
      const u = db.prepare('SELECT * FROM usuarios WHERE usuario = ?').get(usuario);
      const agora = Date.now();
      if (u && u.bloqueado_ate > agora) {
        ctx.auditar({ usuario, acao: 'login_bloqueado', alvo: usuario, ip: req.ip });
        const seg = Math.ceil((u.bloqueado_ate - agora) / 1000);
        return reply.code(429).send({ erro: `Muitas tentativas. Tente de novo em ${seg} s`, bloqueadoAte: u.bloqueado_ate });
      }
      const ok = u ? await verificarSenha(senha, u.senha_hash) : await gastarTempoComoSenha(senha);
      if (!ok) {
        registrarFalha(db, u);
        ctx.auditar({ usuario, acao: 'login_falha', alvo: usuario, detalhes: 'senha', ip: req.ip });
        return reply.code(401).send({ erro: 'Usuário ou senha inválidos' });
      }
      if (!u.ativo) {
        ctx.auditar({ usuario, acao: 'login_falha', alvo: usuario, detalhes: 'usuário desativado', ip: req.ip });
        return reply.code(401).send({ erro: 'Usuário ou senha inválidos' });
      }
      if (u.totp_ativo) {
        if (!codigo) return reply.code(401).send({ erro: 'Informe o código do autenticador', precisa2fa: true });
        const passo = verificarTotp(u.totp_segredo, codigo, { ultimoPasso: u.totp_ultimo_passo });
        if (passo == null) {
          registrarFalha(db, u);
          ctx.auditar({ usuario, acao: 'login_falha', alvo: usuario, detalhes: '2fa', ip: req.ip });
          return reply.code(401).send({ erro: 'Código 2FA inválido', precisa2fa: true });
        }
        db.prepare('UPDATE usuarios SET totp_ultimo_passo = ? WHERE id = ?').run(passo, u.id);
      }
      db.prepare('UPDATE usuarios SET falhas = 0, bloqueado_ate = 0, ultimo_login = ? WHERE id = ?').run(agora, u.id);
      const { token, maxAge } = criarSessao(ctx, u.id, req.ip);
      ctx.auditar({ usuario, acao: 'login', alvo: usuario, ip: req.ip });
      definirCookie(reply, token, maxAge);
      return { ok: true, usuario, totpAtivo: !!u.totp_ativo };
    });

    app.post('/api/logout', async (req, reply) => {
      const token = lerCookies(req.headers.cookie)[COOKIE_SESSAO];
      const s = obterSessao(ctx, req);
      if (token) db.prepare('DELETE FROM sessoes WHERE token_hash = ?').run(sha256(token));
      if (s) {
        ctx.auditar({ usuario: s.usuario, acao: 'logout', ip: req.ip });
        ctx.hubPainel.fecharSessao(s.id);
      }
      definirCookie(reply, '', 0);
      return { ok: true };
    });

    app.post('/api/senha', {
      preHandler: ctx.exigirLogin,
      config: limiteLogin,
      schema: { body: { type: 'object', required: ['atual', 'nova'], additionalProperties: false,
        properties: { atual: { type: 'string', maxLength: 256 }, nova: senhaSchema } } },
    }, async (req, reply) => {
      const u = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(req.sessao.usuario_id);
      if (!(await verificarSenha(req.body.atual, u.senha_hash))) return reply.code(400).send({ erro: 'Senha atual incorreta' });
      const fraca = validarSenhaForte(req.body.nova);
      if (fraca) return reply.code(400).send({ erro: fraca });
      db.prepare('UPDATE usuarios SET senha_hash = ? WHERE id = ?').run(await hashSenha(req.body.nova), u.id);
      // Derruba as outras sessões do usuário.
      for (const { id } of db.prepare('SELECT id FROM sessoes WHERE usuario_id = ? AND id <> ?').all(u.id, req.sessao.id)) ctx.hubPainel.fecharSessao(id);
      db.prepare('DELETE FROM sessoes WHERE usuario_id = ? AND id <> ?').run(u.id, req.sessao.id);
      ctx.auditarReq(req, 'senha_alterada', { alvo: u.usuario });
      return { ok: true };
    });

    // ---- 2FA ----
    app.post('/api/2fa/iniciar', { preHandler: ctx.exigirLogin }, async (req, reply) => {
      if (req.sessao.totp_ativo) return reply.code(409).send({ erro: '2FA já está ativo' });
      const segredo = novoSegredoTotp();
      db.prepare('UPDATE usuarios SET totp_pendente = ? WHERE id = ?').run(segredo, req.sessao.usuario_id);
      return { segredo, uri: uriOtpauth(segredo, req.sessao.usuario) };
    });

    app.post('/api/2fa/ativar', {
      preHandler: ctx.exigirLogin,
      config: limiteLogin,
      schema: { body: { type: 'object', required: ['codigo'], properties: { codigo: codigoSchema } } },
    }, async (req, reply) => {
      const u = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(req.sessao.usuario_id);
      if (!u.totp_pendente) return reply.code(400).send({ erro: 'Inicie a configuração do 2FA primeiro' });
      const passo = verificarTotp(u.totp_pendente, req.body.codigo);
      if (passo == null) return reply.code(400).send({ erro: 'Código inválido. Confira o relógio do celular.' });
      db.prepare('UPDATE usuarios SET totp_segredo = totp_pendente, totp_pendente = NULL, totp_ativo = 1, totp_ultimo_passo = ? WHERE id = ?')
        .run(passo, u.id);
      ctx.auditarReq(req, '2fa_ativado', { alvo: u.usuario });
      return { ok: true };
    });

    app.post('/api/elevar', {
      preHandler: ctx.exigirLogin,
      config: limiteLogin,
      schema: { body: { type: 'object', required: ['codigo'], properties: { codigo: codigoSchema } } },
    }, async (req, reply) => {
      const u = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(req.sessao.usuario_id);
      if (!u.totp_ativo) return reply.code(403).send({ erro: 'Ative o 2FA em Configurações primeiro', precisa2fa: true });
      const passo = verificarTotp(u.totp_segredo, req.body.codigo, { ultimoPasso: u.totp_ultimo_passo });
      if (passo == null) {
        ctx.auditarReq(req, 'elevacao_falha');
        return reply.code(401).send({ erro: 'Código 2FA inválido' });
      }
      const ate = Date.now() + MINUTOS_ELEVADO * 60_000;
      db.prepare('UPDATE usuarios SET totp_ultimo_passo = ? WHERE id = ?').run(passo, u.id);
      db.prepare('UPDATE sessoes SET elevado_ate = ? WHERE id = ?').run(ate, req.sessao.id);
      ctx.auditarReq(req, 'modo_elevado');
      return { ok: true, elevadoAte: ate };
    });

    // ---- Usuários e papéis ----
    const gerenciar = ctx.exigir('usuarios.gerenciar');
    const COLUNAS = 'id, usuario, nome, papel, ativo, totp_ativo, criado_em, ultimo_login, bloqueado_ate';

    app.get('/api/papeis', { preHandler: ctx.exigirLogin }, async () => ({
      papeis: Object.entries(PAPEIS).map(([id, p]) => ({ id, ...p, permissoes: ctx.permissoes.doPapel(id) })),
      permissoes: ctx.permissoes.listar(),
    }));

    app.get('/api/usuarios', { preHandler: gerenciar }, async () =>
      db.prepare(`SELECT ${COLUNAS} FROM usuarios ORDER BY usuario COLLATE NOCASE`).all());

    app.post('/api/usuarios', {
      preHandler: [...gerenciar, ctx.exigirElevado()],
      schema: { body: { type: 'object', required: ['usuario', 'senha', 'papel'], additionalProperties: false,
        properties: { usuario: usuarioSchema, senha: senhaSchema, papel: papelSchema, nome: { type: 'string', maxLength: 120 } } } },
    }, async (req, reply) => {
      const b = req.body;
      const fraca = validarSenhaForte(b.senha);
      if (fraca) return reply.code(400).send({ erro: fraca });
      if (db.prepare('SELECT 1 FROM usuarios WHERE usuario = ?').get(b.usuario)) return reply.code(409).send({ erro: 'Já existe um usuário com esse nome' });
      const id = await criarUsuario(db, b.usuario, b.senha, { papel: b.papel, nome: b.nome || null });
      ctx.auditarReq(req, 'usuario_criado', { alvo: b.usuario, detalhes: { papel: b.papel } });
      return db.prepare(`SELECT ${COLUNAS} FROM usuarios WHERE id = ?`).get(id);
    });

    app.put('/api/usuarios/:id', {
      preHandler: [...gerenciar, ctx.exigirElevado()],
      schema: { params: PARAMS_ID, body: { type: 'object', additionalProperties: false,
        properties: { papel: papelSchema, ativo: { type: 'boolean' }, nome: { type: ['string', 'null'], maxLength: 120 }, redefinir2fa: { type: 'boolean' } } } },
    }, async (req, reply) => {
      const u = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(req.params.id);
      if (!u) return reply.code(404).send({ erro: 'Usuário não encontrado' });
      const b = req.body;
      const perdeAdmin = u.papel === 'admin' && u.ativo && ((b.papel && b.papel !== 'admin') || b.ativo === false);
      if (perdeAdmin && adminsAtivos(db) <= 1) return reply.code(409).send({ erro: 'Não é possível remover o último administrador ativo' });
      if (b.papel) db.prepare('UPDATE usuarios SET papel = ? WHERE id = ?').run(b.papel, u.id);
      if (b.ativo !== undefined) db.prepare('UPDATE usuarios SET ativo = ? WHERE id = ?').run(b.ativo ? 1 : 0, u.id);
      if (b.nome !== undefined) db.prepare('UPDATE usuarios SET nome = ? WHERE id = ?').run(b.nome || null, u.id);
      if (b.redefinir2fa) db.prepare('UPDATE usuarios SET totp_ativo = 0, totp_segredo = NULL, totp_pendente = NULL WHERE id = ?').run(u.id);
      if (b.ativo === false || b.redefinir2fa) {
        db.prepare('DELETE FROM sessoes WHERE usuario_id = ?').run(u.id);
        ctx.hubPainel.fecharUsuario(u.usuario);
      }
      ctx.auditarReq(req, 'usuario_alterado', { alvo: u.usuario, detalhes: b });
      return db.prepare(`SELECT ${COLUNAS} FROM usuarios WHERE id = ?`).get(u.id);
    });

    app.delete('/api/usuarios/:id', {
      preHandler: [...gerenciar, ctx.exigirElevado()], schema: { params: PARAMS_ID },
    }, async (req, reply) => {
      const u = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(req.params.id);
      if (!u) return reply.code(404).send({ erro: 'Usuário não encontrado' });
      if (u.id === req.sessao.usuario_id) return reply.code(409).send({ erro: 'Você não pode excluir a própria conta' });
      if (u.papel === 'admin' && u.ativo && adminsAtivos(db) <= 1) return reply.code(409).send({ erro: 'Não é possível remover o último administrador ativo' });
      ctx.hubPainel.fecharUsuario(u.usuario);
      db.prepare('DELETE FROM usuarios WHERE id = ?').run(u.id);
      ctx.auditarReq(req, 'usuario_excluido', { alvo: u.usuario });
      return { ok: true };
    });
  },

  aoIniciar(ctx) {
    // limpeza de sessões expiradas
    ctx.agendador.registrar('auth.sessoes', 3600_000, (c, agora) => {
      c.db.prepare('DELETE FROM sessoes WHERE expira_em < ?').run(agora);
    }, { imediato: true });
  },
};
