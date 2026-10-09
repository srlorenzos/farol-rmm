// Autenticação do painel: setup inicial, login com bloqueio progressivo, 2FA TOTP e modo elevado.
import {
  hashSenha, verificarSenha, gastarTempoComoSenha, verificarTotp, novoSegredoTotp, uriOtpauth, sha256,
} from '../seguranca.js';
import {
  auditar, criarSessao, obterSessao, exigirLogin, montarCookie, lerCookies, COOKIE_SESSAO,
} from '../nucleo.js';

export const MAX_FALHAS = 5;
export const MINUTOS_ELEVADO = 10;

const usuarioSchema = { type: 'string', minLength: 3, maxLength: 64, pattern: '^[A-Za-z0-9._@-]+$' };
const senhaSchema = { type: 'string', minLength: 10, maxLength: 256 };
const codigoSchema = { type: 'string', pattern: '^[0-9]{6}$' };

export function validarSenhaForte(senha) {
  if (senha.length < 10) return 'A senha precisa de pelo menos 10 caracteres';
  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((r) => r.test(senha)).length;
  if (classes < 3) return 'Use pelo menos 3 tipos: minúsculas, maiúsculas, números, símbolos';
  return null;
}

export async function criarUsuario(db, usuario, senha) {
  const hash = await hashSenha(senha);
  const r = db.prepare('INSERT INTO usuarios (usuario, senha_hash, criado_em) VALUES (?, ?, ?)').run(usuario, hash, Date.now());
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

export default async function rotasAuth(app, ctx) {
  const { db, config } = ctx;
  const autenticado = exigirLogin(ctx);
  const ip = (req) => req.ip;

  app.get('/api/estado', async (req) => {
    const s = obterSessao(ctx, req);
    return {
      precisaSetup: totalUsuarios(db) === 0,
      autenticado: !!s,
      usuario: s?.usuario ?? null,
      totpAtivo: !!s?.totp_ativo,
      elevadoAte: s?.elevado_ate ?? 0,
      agora: Date.now(),
    };
  });

  app.post('/api/setup', {
    config: { rateLimit: { max: config.limites.login, timeWindow: '1 minute' } },
    schema: { body: { type: 'object', required: ['usuario', 'senha'], additionalProperties: false,
      properties: { usuario: usuarioSchema, senha: senhaSchema } } },
  }, async (req, reply) => {
    if (totalUsuarios(db) > 0) return reply.code(409).send({ erro: 'O administrador já foi criado' });
    const fraca = validarSenhaForte(req.body.senha);
    if (fraca) return reply.code(400).send({ erro: fraca });
    const id = await criarUsuario(db, req.body.usuario, req.body.senha);
    auditar(db, { usuario: req.body.usuario, acao: 'admin_criado', alvo: req.body.usuario, ip: ip(req) });
    const { token, maxAge } = criarSessao(ctx, id, ip(req));
    reply.header('set-cookie', montarCookie(COOKIE_SESSAO, token, { maxAge, seguro: config.https }));
    return { ok: true, usuario: req.body.usuario };
  });

  app.post('/api/login', {
    config: { rateLimit: { max: config.limites.login, timeWindow: '1 minute' } },
    schema: { body: { type: 'object', required: ['usuario', 'senha'], additionalProperties: false,
      properties: { usuario: { type: 'string', maxLength: 64 }, senha: { type: 'string', maxLength: 256 },
        codigo: { type: 'string', maxLength: 6 } } } },
  }, async (req, reply) => {
    const { usuario, senha, codigo } = req.body;
    const u = db.prepare('SELECT * FROM usuarios WHERE usuario = ?').get(usuario);
    const agora = Date.now();
    if (u && u.bloqueado_ate > agora) {
      auditar(db, { usuario, acao: 'login_bloqueado', alvo: usuario, ip: ip(req) });
      const seg = Math.ceil((u.bloqueado_ate - agora) / 1000);
      return reply.code(429).send({ erro: `Muitas tentativas. Tente de novo em ${seg} s`, bloqueadoAte: u.bloqueado_ate });
    }
    const ok = u ? await verificarSenha(senha, u.senha_hash) : await gastarTempoComoSenha(senha);
    if (!ok) {
      registrarFalha(db, u);
      auditar(db, { usuario, acao: 'login_falha', alvo: usuario, detalhes: 'senha', ip: ip(req) });
      return reply.code(401).send({ erro: 'Usuário ou senha inválidos' });
    }
    if (u.totp_ativo) {
      if (!codigo) return reply.code(401).send({ erro: 'Informe o código do autenticador', precisa2fa: true });
      const passo = verificarTotp(u.totp_segredo, codigo, { ultimoPasso: u.totp_ultimo_passo });
      if (passo == null) {
        registrarFalha(db, u);
        auditar(db, { usuario, acao: 'login_falha', alvo: usuario, detalhes: '2fa', ip: ip(req) });
        return reply.code(401).send({ erro: 'Código 2FA inválido', precisa2fa: true });
      }
      db.prepare('UPDATE usuarios SET totp_ultimo_passo = ? WHERE id = ?').run(passo, u.id);
    }
    db.prepare('UPDATE usuarios SET falhas = 0, bloqueado_ate = 0 WHERE id = ?').run(u.id);
    const { token, maxAge } = criarSessao(ctx, u.id, ip(req));
    auditar(db, { usuario, acao: 'login', alvo: usuario, ip: ip(req) });
    reply.header('set-cookie', montarCookie(COOKIE_SESSAO, token, { maxAge, seguro: config.https }));
    return { ok: true, usuario, totpAtivo: !!u.totp_ativo };
  });

  app.post('/api/logout', async (req, reply) => {
    const token = lerCookies(req.headers.cookie)[COOKIE_SESSAO];
    const s = obterSessao(ctx, req);
    if (token) db.prepare('DELETE FROM sessoes WHERE token_hash = ?').run(sha256(token));
    if (s) auditar(db, { usuario: s.usuario, acao: 'logout', ip: ip(req) });
    reply.header('set-cookie', montarCookie(COOKIE_SESSAO, '', { maxAge: 0, seguro: config.https }));
    return { ok: true };
  });

  app.post('/api/senha', {
    preHandler: autenticado,
    schema: { body: { type: 'object', required: ['atual', 'nova'], additionalProperties: false,
      properties: { atual: { type: 'string', maxLength: 256 }, nova: senhaSchema } } },
  }, async (req, reply) => {
    const u = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(req.sessao.usuario_id);
    if (!(await verificarSenha(req.body.atual, u.senha_hash))) return reply.code(400).send({ erro: 'Senha atual incorreta' });
    const fraca = validarSenhaForte(req.body.nova);
    if (fraca) return reply.code(400).send({ erro: fraca });
    db.prepare('UPDATE usuarios SET senha_hash = ? WHERE id = ?').run(await hashSenha(req.body.nova), u.id);
    // Derruba as outras sessões do usuário.
    db.prepare('DELETE FROM sessoes WHERE usuario_id = ? AND id <> ?').run(u.id, req.sessao.id);
    auditar(db, { usuario: u.usuario, acao: 'senha_alterada', alvo: u.usuario, ip: ip(req) });
    return { ok: true };
  });

  // ---- 2FA ----
  app.post('/api/2fa/iniciar', { preHandler: autenticado }, async (req, reply) => {
    if (req.sessao.totp_ativo) return reply.code(409).send({ erro: '2FA já está ativo' });
    const segredo = novoSegredoTotp();
    db.prepare('UPDATE usuarios SET totp_pendente = ? WHERE id = ?').run(segredo, req.sessao.usuario_id);
    return { segredo, uri: uriOtpauth(segredo, req.sessao.usuario) };
  });

  app.post('/api/2fa/ativar', {
    preHandler: autenticado,
    schema: { body: { type: 'object', required: ['codigo'], properties: { codigo: codigoSchema } } },
  }, async (req, reply) => {
    const u = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(req.sessao.usuario_id);
    if (!u.totp_pendente) return reply.code(400).send({ erro: 'Inicie a configuração do 2FA primeiro' });
    const passo = verificarTotp(u.totp_pendente, req.body.codigo);
    if (passo == null) return reply.code(400).send({ erro: 'Código inválido. Confira o relógio do celular.' });
    db.prepare('UPDATE usuarios SET totp_segredo = totp_pendente, totp_pendente = NULL, totp_ativo = 1, totp_ultimo_passo = ? WHERE id = ?')
      .run(passo, u.id);
    auditar(db, { usuario: u.usuario, acao: '2fa_ativado', alvo: u.usuario, ip: ip(req) });
    return { ok: true };
  });

  app.post('/api/elevar', {
    preHandler: autenticado,
    config: { rateLimit: { max: config.limites.login, timeWindow: '1 minute' } },
    schema: { body: { type: 'object', required: ['codigo'], properties: { codigo: codigoSchema } } },
  }, async (req, reply) => {
    const u = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(req.sessao.usuario_id);
    if (!u.totp_ativo) return reply.code(403).send({ erro: 'Ative o 2FA em Configurações primeiro', precisa2fa: true });
    const passo = verificarTotp(u.totp_segredo, req.body.codigo, { ultimoPasso: u.totp_ultimo_passo });
    if (passo == null) {
      auditar(db, { usuario: u.usuario, acao: 'elevacao_falha', ip: ip(req) });
      return reply.code(401).send({ erro: 'Código 2FA inválido' });
    }
    const ate = Date.now() + MINUTOS_ELEVADO * 60_000;
    db.prepare('UPDATE usuarios SET totp_ultimo_passo = ? WHERE id = ?').run(passo, u.id);
    db.prepare('UPDATE sessoes SET elevado_ate = ? WHERE id = ?').run(ate, req.sessao.id);
    auditar(db, { usuario: u.usuario, acao: 'modo_elevado', ip: ip(req) });
    return { ok: true, elevadoAte: ate };
  });
}
