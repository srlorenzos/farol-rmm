// Grupos dinâmicos (por filtro: SO, site/cliente, nome contém, tag, campo personalizado) e campos
// personalizados (UDFs) por dispositivo. Um grupo nunca guarda uma lista de membros — ele guarda só o
// filtro, e é resolvido de novo a cada uso (ctx.alvos.registrar('grupo', ...)), então um dispositivo novo
// que bate com o filtro já aparece sozinho, sem precisar editar o grupo. Mesma ideia de "visão salva".
import { PARAMS_ID, PARAMS_AGENTE, erroHttp, like } from '../../nucleo/util.js';
import { marcadores } from '../../db.js';

const TIPOS_CAMPO = ['texto', 'numero', 'booleano', 'selecao'];
const SOS = ['windows', 'linux', 'macos'];

function slugificar(texto) {
  return String(texto).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'campo';
}

/** Monta a cláusula WHERE (+ argumentos) de um filtro de grupo contra `agentes a`. Nunca inclui revogados. */
function construirFiltro(filtro = {}) {
  const onde = ['a.revogado = 0'];
  const args = [];
  // a.so vem cru do agente ("Windows", "Linux", "Darwin"...) — mesma normalização de jobs.soDoAgente()
  // pra "windows"/"linux"/"macos", só que em SQL (o filtro guarda a chave normalizada).
  if (filtro.so?.length) {
    onde.push(`(CASE WHEN LOWER(a.so) LIKE 'win%' THEN 'windows' WHEN LOWER(a.so) = 'darwin' OR LOWER(a.so) LIKE 'mac%' THEN 'macos'
      WHEN a.so IS NOT NULL AND a.so != '' THEN 'linux' ELSE NULL END) IN (${marcadores(filtro.so.length)})`);
    args.push(...filtro.so);
  }
  if (filtro.site_id) { onde.push('a.site_id = ?'); args.push(Number(filtro.site_id)); }
  if (filtro.cliente_id) { onde.push('a.site_id IN (SELECT id FROM sites WHERE cliente_id = ?)'); args.push(Number(filtro.cliente_id)); }
  if (filtro.nome_contem) { onde.push("a.hostname LIKE ? ESCAPE '\\'"); args.push(like(filtro.nome_contem)); }
  if (filtro.tag) { onde.push('EXISTS (SELECT 1 FROM agentes_tags t WHERE t.agente_id = a.id AND t.tag = ? COLLATE NOCASE)'); args.push(filtro.tag); }
  if (filtro.campo?.campo_id) {
    const op = filtro.campo.operador === 'contem' ? "LIKE ? ESCAPE '\\'" : '= ?';
    const valor = filtro.campo.operador === 'contem' ? like(filtro.campo.valor ?? '') : String(filtro.campo.valor ?? '');
    onde.push(`EXISTS (SELECT 1 FROM campos_valores cv WHERE cv.agente_id = a.id AND cv.campo_id = ? AND cv.valor ${op})`);
    args.push(Number(filtro.campo.campo_id), valor);
  }
  return { sql: onde.join(' AND '), args };
}

function agentesDoFiltro(db, filtro, limite = null) {
  const { sql, args } = construirFiltro(filtro);
  const total = db.prepare(`SELECT COUNT(*) AS n FROM agentes a WHERE ${sql}`).get(...args).n;
  const linhas = db.prepare(`SELECT a.id, a.hostname, a.so, a.status, s.nome AS site_nome FROM agentes a JOIN sites s ON s.id = a.site_id
    WHERE ${sql} ORDER BY a.hostname COLLATE NOCASE${limite ? ' LIMIT ?' : ''}`).all(...args, ...(limite ? [limite] : []));
  return { total, agentes: linhas };
}

const FILTRO_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    so: { type: 'array', maxItems: 3, uniqueItems: true, items: { type: 'string', enum: SOS } },
    site_id: { type: 'integer', minimum: 1 },
    cliente_id: { type: 'integer', minimum: 1 },
    nome_contem: { type: 'string', maxLength: 100 },
    tag: { type: 'string', maxLength: 60 },
    campo: { type: 'object', additionalProperties: false, required: ['campo_id'],
      properties: { campo_id: { type: 'integer', minimum: 1 }, operador: { type: 'string', enum: ['igual', 'contem'] }, valor: { type: 'string', maxLength: 200 } } },
  },
};

function linhaCampo(c) {
  return { id: c.id, nome: c.nome, chave: c.chave, tipo: c.tipo, opcoes: c.opcoes_json ? JSON.parse(c.opcoes_json) : [], criado_em: c.criado_em };
}

export default {
  nome: 'grupos',
  descricao: 'Grupos dinâmicos por filtro e campos personalizados (UDFs) por dispositivo',
  depende: ['agentes'],
  permissoes: {
    'grupos.ver': { descricao: 'Ver grupos dinâmicos', papeis: ['tecnico', 'leitura'] },
    'grupos.gerenciar': { descricao: 'Criar, editar e excluir grupos dinâmicos', papeis: ['tecnico'] },
    'campos.gerenciar': { descricao: 'Criar e excluir campos personalizados (UDFs)' },
    'campos.editar': { descricao: 'Editar valores de campos personalizados e tags nos dispositivos', papeis: ['tecnico'] },
  },

  migracoes: [
    `CREATE TABLE grupos (
      id INTEGER PRIMARY KEY,
      nome TEXT NOT NULL,
      filtro_json TEXT NOT NULL,
      criado_por TEXT NOT NULL,
      criado_em INTEGER NOT NULL,
      atualizado_em INTEGER NOT NULL
    );
    CREATE TABLE agentes_tags (
      agente_id TEXT NOT NULL REFERENCES agentes(id) ON DELETE CASCADE,
      tag TEXT NOT NULL,
      PRIMARY KEY (agente_id, tag)
    );
    CREATE TABLE campos_def (
      id INTEGER PRIMARY KEY,
      nome TEXT NOT NULL,
      chave TEXT NOT NULL UNIQUE,
      tipo TEXT NOT NULL,
      opcoes_json TEXT,
      criado_em INTEGER NOT NULL
    );
    CREATE TABLE campos_valores (
      agente_id TEXT NOT NULL REFERENCES agentes(id) ON DELETE CASCADE,
      campo_id INTEGER NOT NULL REFERENCES campos_def(id) ON DELETE CASCADE,
      valor TEXT NOT NULL,
      PRIMARY KEY (agente_id, campo_id)
    );`,
  ],

  aoIniciar(ctx) {
    // Nunca guarda membros: cada resolução roda o filtro de novo contra os agentes atuais — um
    // dispositivo que passa a bater com o filtro aparece no próximo uso, sem editar o grupo.
    ctx.alvos.registrar('grupo', (id, c) => {
      const g = c.db.prepare('SELECT filtro_json FROM grupos WHERE id = ?').get(Number(id));
      if (!g) throw erroHttp(400, 'Grupo não encontrado');
      return agentesDoFiltro(c.db, JSON.parse(g.filtro_json)).agentes.map((a) => a.id);
    }, { descricao: 'Grupo dinâmico (filtro salvo: SO, site, nome, tag ou campo personalizado)' });
  },

  rotas(app, ctx) {
    const { db } = ctx;
    const ver = ctx.exigir('grupos.ver');
    const gerenciar = ctx.exigir('grupos.gerenciar');

    // ---------- grupos dinâmicos ----------
    function linhaGrupo(g, comContagem = true) {
      const base = { id: g.id, nome: g.nome, filtro: JSON.parse(g.filtro_json), criado_por: g.criado_por, criado_em: g.criado_em, atualizado_em: g.atualizado_em };
      if (!comContagem) return base;
      return { ...base, total: agentesDoFiltro(db, base.filtro).total };
    }

    app.get('/api/grupos', { preHandler: ver }, async () =>
      db.prepare('SELECT * FROM grupos ORDER BY nome COLLATE NOCASE').all().map((g) => linhaGrupo(g)));

    app.get('/api/grupos/:id', { preHandler: ver, schema: { params: PARAMS_ID } }, async (req, reply) => {
      const g = db.prepare('SELECT * FROM grupos WHERE id = ?').get(req.params.id);
      if (!g) return reply.code(404).send({ erro: 'Grupo não encontrado' });
      const filtro = JSON.parse(g.filtro_json);
      const { total, agentes } = agentesDoFiltro(db, filtro, 200);
      return { ...linhaGrupo(g, false), total, agentes };
    });

    app.post('/api/grupos/preview', {
      preHandler: ver,
      schema: { body: { type: 'object', additionalProperties: false, required: ['filtro'], properties: { filtro: FILTRO_SCHEMA } } },
    }, async (req) => {
      const { total, agentes } = agentesDoFiltro(db, req.body.filtro, 50);
      return { total, agentes };
    });

    app.post('/api/grupos', {
      preHandler: gerenciar,
      schema: { body: { type: 'object', additionalProperties: false, required: ['nome', 'filtro'], properties: { nome: { type: 'string', minLength: 1, maxLength: 120 }, filtro: FILTRO_SCHEMA } } },
    }, async (req, reply) => {
      const agora = Date.now();
      const r = db.prepare('INSERT INTO grupos (nome, filtro_json, criado_por, criado_em, atualizado_em) VALUES (?, ?, ?, ?, ?)')
        .run(req.body.nome, JSON.stringify(req.body.filtro ?? {}), req.sessao.usuario, agora, agora);
      const id = Number(r.lastInsertRowid);
      ctx.auditarReq(req, 'grupo_criado', { alvo: req.body.nome, detalhes: { id, filtro: req.body.filtro } });
      ctx.emitir('grupo', { id, criado: true });
      return reply.code(201).send(linhaGrupo(db.prepare('SELECT * FROM grupos WHERE id = ?').get(id)));
    });

    app.put('/api/grupos/:id', {
      preHandler: gerenciar,
      schema: { params: PARAMS_ID, body: { type: 'object', additionalProperties: false, minProperties: 1, properties: { nome: { type: 'string', minLength: 1, maxLength: 120 }, filtro: FILTRO_SCHEMA } } },
    }, async (req, reply) => {
      const atual = db.prepare('SELECT * FROM grupos WHERE id = ?').get(req.params.id);
      if (!atual) return reply.code(404).send({ erro: 'Grupo não encontrado' });
      const nome = req.body.nome ?? atual.nome;
      const filtro = req.body.filtro ?? JSON.parse(atual.filtro_json);
      db.prepare('UPDATE grupos SET nome = ?, filtro_json = ?, atualizado_em = ? WHERE id = ?').run(nome, JSON.stringify(filtro), Date.now(), atual.id);
      ctx.auditarReq(req, 'grupo_alterado', { alvo: nome, detalhes: { id: atual.id, filtro } });
      ctx.emitir('grupo', { id: atual.id, alterado: true });
      return linhaGrupo(db.prepare('SELECT * FROM grupos WHERE id = ?').get(atual.id));
    });

    app.delete('/api/grupos/:id', { preHandler: gerenciar, schema: { params: PARAMS_ID } }, async (req, reply) => {
      const g = db.prepare('SELECT id, nome FROM grupos WHERE id = ?').get(req.params.id);
      if (!g) return reply.code(404).send({ erro: 'Grupo não encontrado' });
      db.prepare('DELETE FROM grupos WHERE id = ?').run(g.id);
      ctx.auditarReq(req, 'grupo_excluido', { alvo: g.nome, detalhes: { id: g.id } });
      ctx.emitir('grupo', { id: g.id, excluido: true });
      return { ok: true };
    });

    // ---------- campos personalizados (definições) ----------
    const campoBody = {
      type: 'object', additionalProperties: false, required: ['nome', 'tipo'],
      properties: {
        nome: { type: 'string', minLength: 1, maxLength: 80 },
        tipo: { type: 'string', enum: TIPOS_CAMPO },
        opcoes: { type: 'array', maxItems: 50, items: { type: 'string', maxLength: 100 } },
      },
    };

    app.get('/api/campos', { preHandler: ctx.exigirLogin }, async () => db.prepare('SELECT * FROM campos_def ORDER BY nome COLLATE NOCASE').all().map(linhaCampo));

    app.post('/api/campos', { preHandler: ctx.exigir('campos.gerenciar'), schema: { body: campoBody } }, async (req, reply) => {
      const b = req.body;
      if (b.tipo === 'selecao' && !b.opcoes?.length) return reply.code(400).send({ erro: 'Campo de seleção precisa de pelo menos uma opção' });
      let chave = slugificar(b.nome);
      if (db.prepare('SELECT 1 FROM campos_def WHERE chave = ?').get(chave)) chave = `${chave}-${Date.now().toString(36)}`;
      const r = db.prepare('INSERT INTO campos_def (nome, chave, tipo, opcoes_json, criado_em) VALUES (?, ?, ?, ?, ?)')
        .run(b.nome, chave, b.tipo, b.opcoes?.length ? JSON.stringify(b.opcoes) : null, Date.now());
      const id = Number(r.lastInsertRowid);
      ctx.auditarReq(req, 'campo_criado', { alvo: b.nome, detalhes: { id, tipo: b.tipo } });
      ctx.emitir('campo', { id, criado: true });
      return reply.code(201).send(linhaCampo(db.prepare('SELECT * FROM campos_def WHERE id = ?').get(id)));
    });

    app.delete('/api/campos/:id', { preHandler: ctx.exigir('campos.gerenciar'), schema: { params: PARAMS_ID } }, async (req, reply) => {
      const c = db.prepare('SELECT id, nome FROM campos_def WHERE id = ?').get(req.params.id);
      if (!c) return reply.code(404).send({ erro: 'Campo não encontrado' });
      db.prepare('DELETE FROM campos_def WHERE id = ?').run(c.id);
      ctx.auditarReq(req, 'campo_excluido', { alvo: c.nome, detalhes: { id: c.id } });
      ctx.emitir('campo', { id: c.id, excluido: true });
      return { ok: true };
    });

    // ---------- valores de campos personalizados + tags por dispositivo ----------
    app.get('/api/agentes/:id/campos', { preHandler: ctx.exigirLogin, schema: { params: PARAMS_AGENTE } }, async (req) => {
      const defs = db.prepare('SELECT * FROM campos_def ORDER BY nome COLLATE NOCASE').all();
      const valores = new Map(db.prepare('SELECT campo_id, valor FROM campos_valores WHERE agente_id = ?').all(req.params.id).map((v) => [v.campo_id, v.valor]));
      return defs.map((d) => ({ ...linhaCampo(d), valor: valores.get(d.id) ?? null }));
    });

    app.put('/api/agentes/:id/campos', {
      preHandler: ctx.exigir('campos.editar'),
      schema: { params: PARAMS_AGENTE, body: { type: 'object', additionalProperties: false, required: ['valores'],
        properties: { valores: { type: 'object', maxProperties: 100, additionalProperties: { type: ['string', 'number', 'boolean', 'null'] } } } } },
    }, async (req, reply) => {
      const agente = db.prepare('SELECT id, hostname FROM agentes WHERE id = ?').get(req.params.id);
      if (!agente) return reply.code(404).send({ erro: 'Dispositivo não encontrado' });
      const upsert = db.prepare(`INSERT INTO campos_valores (agente_id, campo_id, valor) VALUES (?, ?, ?)
        ON CONFLICT(agente_id, campo_id) DO UPDATE SET valor = excluded.valor`);
      const apagar = db.prepare('DELETE FROM campos_valores WHERE agente_id = ? AND campo_id = ?');
      for (const [campoId, valor] of Object.entries(req.body.valores)) {
        if (!db.prepare('SELECT 1 FROM campos_def WHERE id = ?').get(campoId)) continue; // campo apagado nesse meio tempo: ignora silenciosamente
        if (valor == null || valor === '') apagar.run(agente.id, campoId);
        else upsert.run(agente.id, campoId, String(valor));
      }
      ctx.auditarReq(req, 'campos_alterados', { alvo: agente.hostname, agente_id: agente.id, detalhes: { valores: req.body.valores } });
      ctx.emitir('campo', { agente_id: agente.id, alterado: true });
      return { ok: true };
    });

    app.get('/api/agentes/:id/tags', { preHandler: ctx.exigirLogin, schema: { params: PARAMS_AGENTE } }, async (req) =>
      db.prepare('SELECT tag FROM agentes_tags WHERE agente_id = ? ORDER BY tag COLLATE NOCASE').all(req.params.id).map((r) => r.tag));

    app.put('/api/agentes/:id/tags', {
      preHandler: ctx.exigir('campos.editar'),
      schema: { params: PARAMS_AGENTE, body: { type: 'object', additionalProperties: false, required: ['tags'],
        properties: { tags: { type: 'array', maxItems: 30, items: { type: 'string', minLength: 1, maxLength: 60 } } } } },
    }, async (req, reply) => {
      const agente = db.prepare('SELECT id, hostname FROM agentes WHERE id = ?').get(req.params.id);
      if (!agente) return reply.code(404).send({ erro: 'Dispositivo não encontrado' });
      const limpas = [...new Set(req.body.tags.map((t) => t.trim()).filter(Boolean))];
      db.prepare('DELETE FROM agentes_tags WHERE agente_id = ?').run(agente.id);
      const ins = db.prepare('INSERT INTO agentes_tags (agente_id, tag) VALUES (?, ?)');
      for (const tag of limpas) ins.run(agente.id, tag);
      ctx.auditarReq(req, 'tags_alteradas', { alvo: agente.hostname, agente_id: agente.id, detalhes: { tags: limpas } });
      ctx.emitir('campo', { agente_id: agente.id, tags: true });
      return limpas;
    });

    app.get('/api/tags', { preHandler: ctx.exigirLogin }, async () =>
      db.prepare('SELECT DISTINCT tag FROM agentes_tags ORDER BY tag COLLATE NOCASE').all().map((r) => r.tag));
  },
};
