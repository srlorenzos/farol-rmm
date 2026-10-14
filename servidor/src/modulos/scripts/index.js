// Scripts do usuário: CRUD com variáveis (formulário), sistemas compatíveis, tipo (ação/monitor/auditoria) e categoria.
// A execução fica no módulo jobs; a biblioteca pronta (servidor/biblioteca) importa para cá.
import { lerConfig, definirConfig } from '../../db.js';
import { PARAMS_ID } from '../../nucleo/util.js';
import { normalizarDefinicoes, TIPOS_VARIAVEL } from '../../nucleo/variaveis.js';
import { SCRIPTS_EXEMPLO } from './exemplos.js';

export const SHELLS = ['powershell', 'cmd', 'bash', 'python'];
const SOS = ['windows', 'linux', 'macos'];
const soPadrao = (shell) => (shell === 'powershell' || shell === 'cmd' ? ['windows'] : shell === 'bash' ? ['linux', 'macos'] : SOS);

const variavelSchema = {
  type: 'object', additionalProperties: false, required: ['nome'],
  properties: {
    nome: { type: 'string', pattern: '^[A-Z][A-Z0-9_]{0,47}$' },
    rotulo: { type: 'string', maxLength: 200 },
    tipo: { type: 'string', enum: TIPOS_VARIAVEL },
    padrao: { type: ['string', 'number', 'boolean', 'null'] },
    obrigatorio: { type: 'boolean' },
    opcoes: { type: 'array', maxItems: 100, items: { type: 'string', maxLength: 200 } },
  },
};

export const scriptSchema = {
  type: 'object', additionalProperties: false, required: ['nome', 'shell', 'conteudo'],
  properties: {
    nome: { type: 'string', minLength: 1, maxLength: 120 },
    descricao: { type: 'string', maxLength: 1000 },
    shell: { type: 'string', enum: SHELLS },
    conteudo: { type: 'string', minLength: 1, maxLength: 200_000 },
    timeout: { type: 'integer', minimum: 5, maximum: 86400 },
    categoria: { type: 'string', maxLength: 80 },
    so: { type: 'array', maxItems: 3, uniqueItems: true, items: { type: 'string', enum: SOS } },
    tipo: { type: 'string', enum: ['acao', 'monitor', 'auditoria'] },
    tags: { type: 'array', maxItems: 20, items: { type: 'string', maxLength: 40 } },
    variaveis: { type: 'array', maxItems: 30, items: variavelSchema },
    requer_admin: { type: 'boolean' },
  },
};

/** Linha do banco → objeto da API (JSONs decodificados). */
export function deserializar(s) {
  if (!s) return s;
  return {
    ...s,
    so: s.so_json ? JSON.parse(s.so_json) : soPadrao(s.shell),
    tags: s.tags_json ? JSON.parse(s.tags_json) : [],
    variaveis: s.variaveis_json ? JSON.parse(s.variaveis_json) : [],
    requer_admin: !!s.requer_admin,
    so_json: undefined, tags_json: undefined, variaveis_json: undefined,
  };
}

export default {
  nome: 'scripts',
  descricao: 'Scripts do usuário',
  permissoes: {
    'scripts.ver': { descricao: 'Ver scripts e o conteúdo deles', papeis: ['tecnico', 'leitura'] },
    'scripts.editar': { descricao: 'Criar, alterar, importar e excluir scripts', papeis: ['tecnico'] },
  },
  migracoes: [
    // 1 — tabela da v1 + exemplos (só em banco novo)
    (db) => {
      db.exec(`CREATE TABLE IF NOT EXISTS scripts (
        id INTEGER PRIMARY KEY,
        nome TEXT NOT NULL,
        descricao TEXT NOT NULL DEFAULT '',
        shell TEXT NOT NULL,
        conteudo TEXT NOT NULL,
        timeout INTEGER NOT NULL DEFAULT 60,
        criado_em INTEGER NOT NULL,
        atualizado_em INTEGER NOT NULL
      )`);
      if (lerConfig(db, 'semeado', false)) return;
      const agora = Date.now();
      const ins = db.prepare(`INSERT INTO scripts (nome, descricao, shell, conteudo, timeout, criado_em, atualizado_em) VALUES (?, ?, ?, ?, ?, ?, ?)`);
      for (const s of SCRIPTS_EXEMPLO) ins.run(s.nome, s.descricao, s.shell, s.conteudo, s.timeout, agora, agora);
      definirConfig(db, 'semeado', true);
    },
    // 2 — v2: metadados e variáveis
    `ALTER TABLE scripts ADD COLUMN categoria TEXT NOT NULL DEFAULT 'Geral';
    ALTER TABLE scripts ADD COLUMN so_json TEXT;
    ALTER TABLE scripts ADD COLUMN tipo TEXT NOT NULL DEFAULT 'acao';
    ALTER TABLE scripts ADD COLUMN tags_json TEXT;
    ALTER TABLE scripts ADD COLUMN variaveis_json TEXT;
    ALTER TABLE scripts ADD COLUMN requer_admin INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE scripts ADD COLUMN origem TEXT;
    ALTER TABLE scripts ADD COLUMN criado_por TEXT;
    CREATE INDEX ix_scripts_origem ON scripts(origem);`,
  ],

  servico(ctx) {
    const { db } = ctx;
    const obter = (id) => deserializar(db.prepare('SELECT * FROM scripts WHERE id = ?').get(id));
    const valores = (b) => [
      b.nome, b.descricao ?? '', b.shell, b.conteudo, b.timeout ?? 60, b.categoria || 'Geral',
      JSON.stringify(b.so?.length ? b.so : soPadrao(b.shell)), b.tipo ?? 'acao', JSON.stringify(b.tags ?? []),
      JSON.stringify(normalizarDefinicoes(b.variaveis)), b.requer_admin ? 1 : 0,
    ];
    return {
      obter,
      /** Cria um script (valida as variáveis). Devolve o script salvo. */
      criar(b, { usuario = null } = {}) {
        const agora = Date.now();
        const r = db.prepare(`INSERT INTO scripts (nome, descricao, shell, conteudo, timeout, categoria, so_json, tipo, tags_json,
            variaveis_json, requer_admin, origem, criado_por, criado_em, atualizado_em)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(...valores(b), b.origem ?? null, usuario, agora, agora);
        return obter(r.lastInsertRowid);
      },
      atualizar(id, b) {
        const r = db.prepare(`UPDATE scripts SET nome = ?, descricao = ?, shell = ?, conteudo = ?, timeout = ?, categoria = ?, so_json = ?,
            tipo = ?, tags_json = ?, variaveis_json = ?, requer_admin = ?, atualizado_em = ? WHERE id = ?`).run(...valores(b), Date.now(), id);
        return r.changes ? obter(id) : null;
      },
    };
  },

  rotas(app, ctx) {
    const { db } = ctx;
    const editar = ctx.exigir('scripts.editar');

    app.get('/api/scripts', { preHandler: ctx.exigir('scripts.ver') }, async () =>
      db.prepare('SELECT * FROM scripts ORDER BY categoria COLLATE NOCASE, nome COLLATE NOCASE').all().map(deserializar));

    app.get('/api/scripts/:id', { preHandler: ctx.exigir('scripts.ver'), schema: { params: PARAMS_ID } }, async (req, reply) =>
      ctx.servicos.scripts.obter(req.params.id) ?? reply.code(404).send({ erro: 'Script não encontrado' }));

    app.post('/api/scripts', { preHandler: editar, schema: { body: scriptSchema } }, async (req) => {
      const s = ctx.servicos.scripts.criar(req.body, { usuario: req.sessao.usuario });
      ctx.auditarReq(req, 'script_criado', { alvo: s.nome });
      return s;
    });

    app.put('/api/scripts/:id', { preHandler: editar, schema: { params: PARAMS_ID, body: scriptSchema } }, async (req, reply) => {
      const s = ctx.servicos.scripts.atualizar(req.params.id, req.body);
      if (!s) return reply.code(404).send({ erro: 'Script não encontrado' });
      ctx.auditarReq(req, 'script_alterado', { alvo: s.nome });
      return s;
    });

    app.delete('/api/scripts/:id', { preHandler: editar, schema: { params: PARAMS_ID } }, async (req, reply) => {
      const s = db.prepare('SELECT nome FROM scripts WHERE id = ?').get(req.params.id);
      if (!s) return reply.code(404).send({ erro: 'Script não encontrado' });
      db.prepare('DELETE FROM scripts WHERE id = ?').run(req.params.id);
      ctx.auditarReq(req, 'script_excluido', { alvo: s.nome });
      return { ok: true };
    });
  },
};
