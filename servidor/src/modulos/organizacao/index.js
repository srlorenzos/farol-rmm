// Clientes e sites. As tabelas são do núcleo (todo agente pertence a um site); aqui ficam a API e as regras.
import { PARAMS_ID } from '../../nucleo/util.js';

const nomeSchema = { type: 'string', minLength: 1, maxLength: 120 };

export default {
  nome: 'organizacao',
  descricao: 'Clientes e sites',
  permissoes: {
    'organizacao.ver': { descricao: 'Ver clientes e sites', papeis: ['tecnico', 'leitura'] },
    'organizacao.gerenciar': { descricao: 'Criar, renomear e excluir clientes e sites' },
  },

  servico(ctx) {
    return {
      /** Árvore cliente → sites com contagem de dispositivos (usada pelo seletor de escopo do painel). */
      arvore() {
        const clientes = ctx.db.prepare('SELECT id, nome, criado_em FROM clientes ORDER BY nome COLLATE NOCASE').all();
        const sites = ctx.db.prepare(`SELECT s.id, s.cliente_id, s.nome, s.criado_em,
            COUNT(a.id) AS dispositivos, SUM(a.status = 'online') AS online
          FROM sites s LEFT JOIN agentes a ON a.site_id = s.id AND a.revogado = 0
          GROUP BY s.id ORDER BY s.nome COLLATE NOCASE`).all();
        return clientes.map((c) => {
          const meus = sites.filter((s) => s.cliente_id === c.id).map((s) => ({ ...s, online: s.online ?? 0 }));
          return { ...c, sites: meus, dispositivos: meus.reduce((n, s) => n + s.dispositivos, 0) };
        });
      },
      siteExiste: (id) => !!ctx.db.prepare('SELECT 1 FROM sites WHERE id = ?').get(id),
    };
  },

  rotas(app, ctx) {
    const { db } = ctx;
    const gerenciar = ctx.exigir('organizacao.gerenciar');
    const conflito = (e, reply, msg) => {
      if (/UNIQUE/.test(e.message)) return reply.code(409).send({ erro: msg });
      throw e;
    };

    app.get('/api/clientes', { preHandler: ctx.exigir('organizacao.ver') }, async () => ctx.servicos.organizacao.arvore());

    app.post('/api/clientes', { preHandler: gerenciar, schema: { body: { type: 'object', required: ['nome'], additionalProperties: false, properties: { nome: nomeSchema } } } },
      async (req, reply) => {
        try {
          const r = db.prepare('INSERT INTO clientes (nome, criado_em) VALUES (?, ?)').run(req.body.nome.trim(), Date.now());
          const id = Number(r.lastInsertRowid);
          // Todo cliente nasce com um site, para que possa receber dispositivos imediatamente.
          db.prepare('INSERT INTO sites (cliente_id, nome, criado_em) VALUES (?, ?, ?)').run(id, 'Principal', Date.now());
          ctx.auditarReq(req, 'cliente_criado', { alvo: req.body.nome });
          ctx.emitir('organizacao', { cliente_id: id });
          return db.prepare('SELECT * FROM clientes WHERE id = ?').get(id);
        } catch (e) { return conflito(e, reply, 'Já existe um cliente com esse nome'); }
      });

    app.put('/api/clientes/:id', { preHandler: gerenciar, schema: { params: PARAMS_ID, body: { type: 'object', required: ['nome'], additionalProperties: false, properties: { nome: nomeSchema } } } },
      async (req, reply) => {
        try {
          const r = db.prepare('UPDATE clientes SET nome = ? WHERE id = ?').run(req.body.nome.trim(), req.params.id);
          if (!r.changes) return reply.code(404).send({ erro: 'Cliente não encontrado' });
        } catch (e) { return conflito(e, reply, 'Já existe um cliente com esse nome'); }
        ctx.auditarReq(req, 'cliente_alterado', { alvo: req.body.nome });
        ctx.emitir('organizacao', { cliente_id: req.params.id });
        return db.prepare('SELECT * FROM clientes WHERE id = ?').get(req.params.id);
      });

    app.delete('/api/clientes/:id', { preHandler: gerenciar, schema: { params: PARAMS_ID } }, async (req, reply) => {
      const c = db.prepare('SELECT * FROM clientes WHERE id = ?').get(req.params.id);
      if (!c) return reply.code(404).send({ erro: 'Cliente não encontrado' });
      const n = db.prepare('SELECT COUNT(*) AS n FROM agentes a JOIN sites s ON s.id = a.site_id WHERE s.cliente_id = ? AND a.revogado = 0').get(c.id).n;
      if (n) return reply.code(409).send({ erro: `O cliente ainda tem ${n} dispositivo(s). Mova-os antes de excluir.` });
      if (db.prepare('SELECT COUNT(*) AS n FROM clientes').get().n <= 1) return reply.code(409).send({ erro: 'É preciso manter pelo menos um cliente' });
      db.prepare('DELETE FROM sites WHERE cliente_id = ? AND id NOT IN (SELECT site_id FROM agentes)').run(c.id);
      if (db.prepare('SELECT 1 FROM sites WHERE cliente_id = ?').get(c.id)) return reply.code(409).send({ erro: 'Há dispositivos revogados ligados a sites deste cliente' });
      db.prepare('DELETE FROM clientes WHERE id = ?').run(c.id);
      ctx.auditarReq(req, 'cliente_excluido', { alvo: c.nome });
      ctx.emitir('organizacao', { cliente_id: c.id });
      return { ok: true };
    });

    app.post('/api/sites', {
      preHandler: gerenciar,
      schema: { body: { type: 'object', required: ['cliente_id', 'nome'], additionalProperties: false, properties: { cliente_id: { type: 'integer', minimum: 1 }, nome: nomeSchema } } },
    }, async (req, reply) => {
      if (!db.prepare('SELECT 1 FROM clientes WHERE id = ?').get(req.body.cliente_id)) return reply.code(404).send({ erro: 'Cliente não encontrado' });
      try {
        const r = db.prepare('INSERT INTO sites (cliente_id, nome, criado_em) VALUES (?, ?, ?)').run(req.body.cliente_id, req.body.nome.trim(), Date.now());
        ctx.auditarReq(req, 'site_criado', { alvo: req.body.nome });
        ctx.emitir('organizacao', { site_id: Number(r.lastInsertRowid) });
        return db.prepare('SELECT * FROM sites WHERE id = ?').get(r.lastInsertRowid);
      } catch (e) { return conflito(e, reply, 'Este cliente já tem um site com esse nome'); }
    });

    app.put('/api/sites/:id', {
      preHandler: gerenciar,
      schema: { params: PARAMS_ID, body: { type: 'object', required: ['nome'], additionalProperties: false, properties: { nome: nomeSchema } } },
    }, async (req, reply) => {
      try {
        const r = db.prepare('UPDATE sites SET nome = ? WHERE id = ?').run(req.body.nome.trim(), req.params.id);
        if (!r.changes) return reply.code(404).send({ erro: 'Site não encontrado' });
      } catch (e) { return conflito(e, reply, 'Este cliente já tem um site com esse nome'); }
      ctx.auditarReq(req, 'site_alterado', { alvo: req.body.nome });
      ctx.emitir('organizacao', { site_id: req.params.id });
      return db.prepare('SELECT * FROM sites WHERE id = ?').get(req.params.id);
    });

    app.delete('/api/sites/:id', { preHandler: gerenciar, schema: { params: PARAMS_ID } }, async (req, reply) => {
      const s = db.prepare('SELECT * FROM sites WHERE id = ?').get(req.params.id);
      if (!s) return reply.code(404).send({ erro: 'Site não encontrado' });
      if (db.prepare('SELECT 1 FROM agentes WHERE site_id = ?').get(s.id)) return reply.code(409).send({ erro: 'O site ainda tem dispositivos. Mova-os antes de excluir.' });
      if (db.prepare('SELECT COUNT(*) AS n FROM sites').get().n <= 1) return reply.code(409).send({ erro: 'É preciso manter pelo menos um site' });
      db.prepare('DELETE FROM sites WHERE id = ?').run(s.id);
      ctx.auditarReq(req, 'site_excluido', { alvo: s.nome });
      ctx.emitir('organizacao', { site_id: s.id });
      return { ok: true };
    });
  },
};
