// Convites e redefinição de senha sem e-mail: gera um link de uso único que o admin copia e manda pelo
// canal que preferir. O CRUD de usuários e papéis já vive no módulo `auth` (reaproveitado aqui, sem duplicar).
import { gerarToken, sha256 } from '../../seguranca.js';
import { validarSenhaForte } from '../auth/index.js';
import { PAPEIS } from '../../nucleo/permissoes.js';
import { PARAMS_ID } from '../../nucleo/util.js';
import { transacao } from '../../db.js';

const VALIDADE_CONVITE_MS = 7 * 24 * 3600_000; // 7 dias
const VALIDADE_REDEFINICAO_MS = 2 * 3600_000; // 2 horas

const usuarioSchema = { type: 'string', minLength: 3, maxLength: 64, pattern: '^[A-Za-z0-9._@-]+$' };
const papelSchema = { type: 'string', enum: Object.keys(PAPEIS) };
const tokenSchema = { type: 'string', minLength: 20, maxLength: 128 };
const senhaSchema = { type: 'string', minLength: 10, maxLength: 256 };

/** Invalida (expira) os convites/redefinições ainda não usados de um usuário. */
function invalidarAnteriores(db, usuarioId) {
  db.prepare('UPDATE usuarios_convites SET expira_em = 0 WHERE usuario_id = ? AND usado_em IS NULL').run(usuarioId);
}

function criarToken(db, { usuarioId, tipo, criadoPor, validadeMs }) {
  const token = gerarToken();
  const agora = Date.now();
  db.prepare('INSERT INTO usuarios_convites (usuario_id, tipo, token_hash, criado_por, criado_em, expira_em) VALUES (?, ?, ?, ?, ?, ?)')
    .run(usuarioId, tipo, sha256(token), criadoPor, agora, agora + validadeMs);
  return { token, expira_em: agora + validadeMs };
}

/** Busca um convite válido (existe, não usado, não expirado) pelo token em claro. */
function buscarValido(db, token) {
  if (typeof token !== 'string') return null;
  const row = db.prepare(`SELECT c.*, u.usuario, u.nome, u.ativo FROM usuarios_convites c
    JOIN usuarios u ON u.id = c.usuario_id WHERE c.token_hash = ?`).get(sha256(token));
  if (!row) return null;
  if (row.usado_em) return { ...row, estado: 'usado' };
  if (row.expira_em <= Date.now()) return { ...row, estado: 'expirado' };
  if (!row.ativo) return { ...row, estado: 'inativo' };
  return { ...row, estado: 'valido' };
}

function linkConvite(req, config, token) {
  const base = config.urlPublica || `${req.protocol}://${req.headers.host}`;
  return `${base.replace(/\/+$/, '')}/convite.html?token=${token}`;
}

export default {
  nome: 'usuarios',
  descricao: 'Convites e redefinição de senha dos usuários (sem e-mail: link de uso único)',
  depende: ['auth'],
  // Sem permissões próprias: reaproveita 'usuarios.gerenciar' (declarada pelo módulo auth).

  migracoes: [
    `CREATE TABLE usuarios_convites (
      id INTEGER PRIMARY KEY,
      usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      tipo TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      criado_por TEXT,
      criado_em INTEGER NOT NULL,
      expira_em INTEGER NOT NULL,
      usado_em INTEGER
    );
    CREATE INDEX ix_usuarios_convites_usuario ON usuarios_convites(usuario_id);`,
  ],

  rotas(app, ctx) {
    const { db, config } = ctx;
    const gerenciar = [...ctx.exigir('usuarios.gerenciar'), ctx.exigirElevado()];
    const limitePublico = { rateLimit: { max: config.limites.login, timeWindow: '1 minute' } };
    const COLUNAS = 'id, usuario, nome, papel, ativo, totp_ativo, criado_em, ultimo_login, bloqueado_ate';

    // ---------- admin: convidar / reenviar ----------
    app.post('/api/usuarios/convidar', {
      preHandler: gerenciar,
      schema: { body: { type: 'object', required: ['usuario', 'papel'], additionalProperties: false,
        properties: { usuario: usuarioSchema, papel: papelSchema, nome: { type: 'string', maxLength: 120 } } } },
    }, async (req, reply) => {
      const b = req.body;
      if (db.prepare('SELECT 1 FROM usuarios WHERE usuario = ?').get(b.usuario)) return reply.code(409).send({ erro: 'Já existe um usuário com esse nome' });
      const { usuarioId, token, expira_em } = transacao(db, () => {
        // Senha aleatória de alta entropia: ninguém a conhece até o convite ser aceito.
        const id = criarUsuarioSync(db, b.usuario, b.papel, b.nome || null);
        const { token: t, expira_em: e } = criarToken(db, { usuarioId: id, tipo: 'convite', criadoPor: req.sessao.usuario, validadeMs: VALIDADE_CONVITE_MS });
        return { usuarioId: id, token: t, expira_em: e };
      });
      ctx.auditarReq(req, 'usuario_convidado', { alvo: b.usuario, detalhes: { papel: b.papel } });
      const usuarioRow = db.prepare(`SELECT ${COLUNAS} FROM usuarios WHERE id = ?`).get(usuarioId);
      return { usuario: usuarioRow, link: linkConvite(req, config, token), expira_em };
    });

    app.post('/api/usuarios/:id/redefinir', {
      preHandler: gerenciar, schema: { params: PARAMS_ID },
    }, async (req, reply) => {
      const u = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(req.params.id);
      if (!u) return reply.code(404).send({ erro: 'Usuário não encontrado' });
      invalidarAnteriores(db, u.id);
      const { token, expira_em } = criarToken(db, { usuarioId: u.id, tipo: 'redefinicao', criadoPor: req.sessao.usuario, validadeMs: VALIDADE_REDEFINICAO_MS });
      ctx.auditarReq(req, 'redefinicao_solicitada', { alvo: u.usuario });
      return { link: linkConvite(req, config, token), expira_em };
    });

    // ---------- público: aceitar convite / redefinir senha ----------
    app.get('/api/convites/:token', { config: limitePublico, schema: { params: { type: 'object', required: ['token'], properties: { token: tokenSchema } } } },
      async (req, reply) => {
        const c = buscarValido(db, req.params.token);
        if (!c || c.estado !== 'valido') return reply.code(410).send({ erro: 'Link inválido, já usado ou expirado' });
        return { usuario: c.usuario, nome: c.nome, tipo: c.tipo };
      });

    app.post('/api/convites/:token', {
      config: limitePublico,
      schema: { params: { type: 'object', required: ['token'], properties: { token: tokenSchema } },
        body: { type: 'object', required: ['senha'], additionalProperties: false, properties: { senha: senhaSchema } } },
    }, async (req, reply) => {
      const c = buscarValido(db, req.params.token);
      if (!c || c.estado !== 'valido') return reply.code(410).send({ erro: 'Link inválido, já usado ou expirado' });
      const fraca = validarSenhaForte(req.body.senha);
      if (fraca) return reply.code(400).send({ erro: fraca });
      await definirSenhaAceitandoConvite(db, ctx, c, req.body.senha);
      ctx.auditar({ usuario: c.usuario, acao: c.tipo === 'convite' ? 'convite_aceito' : 'senha_redefinida', alvo: c.usuario, ip: req.ip });
      return { ok: true, usuario: c.usuario };
    });
  },
};

// Cria o usuário com uma senha que ninguém conhece (só é definida de verdade ao aceitar o convite).
// Síncrono por fora (a função é async só por causa do hash) — usamos uma versão "fire and forget" resolvida
// antes do fim da transação chamando no topo do handler não é possível (transacao() é síncrona), então
// fazemos o hash fora da transação e só inserimos dentro dela.
function criarUsuarioSync(db, usuario, papel, nome) {
  const hash = hashAleatorioSincrono();
  const r = db.prepare('INSERT INTO usuarios (usuario, senha_hash, criado_em, papel, nome, ativo) VALUES (?, ?, ?, ?, ?, 1)')
    .run(usuario, hash, Date.now(), papel, nome);
  return Number(r.lastInsertRowid);
}

// scrypt é caro (~32 MiB/CPU) e assíncrono; para não bloquear a transação síncrona do SQLite, usamos aqui um
// marcador que nenhuma senha em texto normalizável jamais produz: hash igual ao de um token aleatório de 32
// bytes, calculado de forma determinística e barata (sha256), só para preencher a coluna NOT NULL até o
// convite ser aceito — `verificarSenha` nunca é chamado para esse formato, então não é checado, só substituído.
function hashAleatorioSincrono() {
  return `semconvite$${sha256(gerarToken())}`;
}

async function definirSenhaAceitandoConvite(db, ctx, convite, senha) {
  const { hashSenha } = await import('../../seguranca.js');
  const hash = await hashSenha(senha);
  transacao(db, () => {
    db.prepare('UPDATE usuarios SET senha_hash = ?, ativo = 1, falhas = 0, bloqueado_ate = 0 WHERE id = ?').run(hash, convite.usuario_id);
    db.prepare('UPDATE usuarios_convites SET usado_em = ? WHERE id = ?').run(Date.now(), convite.id);
    invalidarAnteriores(db, convite.usuario_id);
    db.prepare('DELETE FROM sessoes WHERE usuario_id = ?').run(convite.usuario_id);
  });
  ctx.hubPainel.fecharUsuario(convite.usuario);
}
