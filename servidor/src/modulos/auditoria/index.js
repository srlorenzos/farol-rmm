// Consulta do log de auditoria. A gravação é do núcleo (ctx.auditar / ctx.auditarReq).
import { ID_AGENTE, like } from '../../nucleo/util.js';

export default {
  nome: 'auditoria',
  descricao: 'Log de auditoria',
  permissoes: {
    'auditoria.ver': { descricao: 'Ver o log de auditoria', papeis: ['tecnico'] },
  },

  rotas(app, ctx) {
    const { db } = ctx;
    app.get('/api/auditoria', {
      preHandler: ctx.exigir('auditoria.ver'),
      schema: { querystring: { type: 'object', properties: {
        acao: { type: 'string', maxLength: 64 }, usuario: { type: 'string', maxLength: 64 },
        q: { type: 'string', maxLength: 120 }, agente: ID_AGENTE,
        antes: { type: 'integer', minimum: 1 },
        limite: { type: 'integer', minimum: 1, maximum: 1000, default: 200 },
      } } },
    }, async (req) => {
      const q = req.query;
      const onde = [];
      const args = [];
      if (q.acao) { onde.push('acao = ?'); args.push(q.acao); }
      if (q.usuario) { onde.push('usuario = ?'); args.push(q.usuario); }
      if (q.agente) { onde.push('agente_id = ?'); args.push(q.agente); }
      if (q.antes) { onde.push('id < ?'); args.push(q.antes); }
      if (q.q) {
        onde.push("(alvo LIKE ? ESCAPE '\\' OR detalhes LIKE ? ESCAPE '\\' OR ip LIKE ? ESCAPE '\\')");
        const l = like(q.q);
        args.push(l, l, l);
      }
      const where = onde.length ? `WHERE ${onde.join(' AND ')}` : '';
      const linhas = db.prepare(`SELECT * FROM auditoria ${where} ORDER BY id DESC LIMIT ?`).all(...args, q.limite);
      const acoes = db.prepare('SELECT DISTINCT acao FROM auditoria ORDER BY acao').all().map((r) => r.acao);
      const usuarios = db.prepare('SELECT DISTINCT usuario FROM auditoria WHERE usuario IS NOT NULL ORDER BY usuario').all().map((r) => r.usuario);
      return { linhas, acoes, usuarios, mais: linhas.length === q.limite };
    });
  },
};
