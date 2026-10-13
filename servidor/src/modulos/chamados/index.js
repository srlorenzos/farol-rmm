// Chamados (helpdesk): tickets abertos pelo usuário final na bandeja do agente, conversa com o técnico,
// anexos (print de tela) e a configuração de marca/contato da bandeja.
//
// Fluxo: a bandeja (processo separado, sessão do usuário) fala com a API local do agente
// (agente/farol/modulos/api_local.py), que encaminha para as rotas /api/agente/chamados* daqui usando
// o canal autenticado do próprio agente (Authorization: Bearer <id>:<segredo>). O painel usa /api/chamados*.
// Quando o técnico responde, avisamos o agente por um comando tipado comum ('chamados.notificar'); chega na
// hora se o canal em tempo real estiver conectado, senão vai na resposta do próximo check-in — sem nada novo
// no núcleo. O print fica em arquivo (dados/anexos-chamados/<chamado>/<id>.<ext>), nunca em memória/BLOB.
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, extname } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { transacao } from '../../db.js';
import { lerConfig, definirConfig } from '../../db.js';
import { PARAMS_ID, filtroEscopo, ESCOPO_QUERY, like } from '../../nucleo/util.js';

export const STATUS = ['aberto', 'em_andamento', 'aguardando_usuario', 'resolvido', 'fechado'];
export const PRIORIDADES = ['baixa', 'normal', 'alta', 'urgente'];
export const CATEGORIAS = ['acesso', 'desempenho', 'rede', 'impressora', 'software', 'hardware', 'email', 'outro'];
const ABERTOS = ['aberto', 'em_andamento', 'aguardando_usuario'];
const MAX_ANEXO = 5 * 1024 * 1024; // 5 MB

const PARAMS_CHAMADO_ANEXO = {
  type: 'object', required: ['id', 'anexoId'],
  properties: { id: { type: 'integer', minimum: 1 }, anexoId: { type: 'integer', minimum: 1 } },
};

function pastaAnexos(config) {
  const base = config.caminhoBanco && config.caminhoBanco !== ':memory:' ? dirname(config.caminhoBanco) : tmpdir();
  return resolve(base, 'anexos-chamados');
}

function salvarAnexo(config, chamadoId, { base64, tipo, nome }) {
  const buf = Buffer.from(String(base64 || ''), 'base64');
  if (!buf.length) throw Object.assign(new Error('Anexo vazio'), { statusCode: 400 });
  if (buf.length > MAX_ANEXO) throw Object.assign(new Error('Anexo maior que 5 MB'), { statusCode: 413 });
  const extValida = { 'image/png': '.png', 'image/jpeg': '.jpg' }[tipo] || extname(nome || '') || '.bin';
  const pasta = resolve(pastaAnexos(config), String(chamadoId));
  mkdirSync(pasta, { recursive: true });
  const arquivo = `${randomUUID()}${extValida}`;
  writeFileSync(resolve(pasta, arquivo), buf);
  return { caminho: resolve(pasta, arquivo), tamanho: buf.length, nome: nome || `print${extValida}`, tipo: tipo || 'application/octet-stream' };
}

function sistemaResumo(d) {
  if (!d || typeof d !== 'object') return null;
  return JSON.stringify(d).slice(0, 8000);
}

function linhaPublica(c) {
  const agora = Date.now();
  const abertoDesde = ABERTOS.includes(c.status) ? agora - c.criado_em : (c.resolvido_em || c.fechado_em || c.criado_em) - c.criado_em;
  return { ...c, sla_minutos: Math.max(0, Math.round(abertoDesde / 60000)) };
}

function configBandejaPadrao() {
  return {
    empresa: 'Farol', cor: '#2563eb', icone_base64: null,
    contato: { telefone: '', email: '', site: '' },
    recursos: { chamados: true, print: true, acoesRapidas: true },
  };
}

export default {
  nome: 'chamados',
  descricao: 'Chamados de suporte abertos pela bandeja do agente',
  depende: ['agentes'],
  permissoes: {
    'chamados.ver': { descricao: 'Ver chamados de suporte', papeis: ['tecnico', 'leitura'] },
    'chamados.responder': { descricao: 'Responder, atribuir e mudar status de chamados', papeis: ['tecnico'] },
    'chamados.configurar': { descricao: 'Configurar marca e contato da bandeja do agente' },
  },

  migracoes: [
    `CREATE TABLE chamados (
      id INTEGER PRIMARY KEY,
      agente_id TEXT NOT NULL REFERENCES agentes(id) ON DELETE CASCADE,
      usuario_windows TEXT,
      assunto TEXT NOT NULL,
      categoria TEXT NOT NULL DEFAULT 'outro',
      prioridade TEXT NOT NULL DEFAULT 'normal',
      status TEXT NOT NULL DEFAULT 'aberto',
      tecnico TEXT,
      dados_sistema_json TEXT,
      criado_em INTEGER NOT NULL,
      atualizado_em INTEGER NOT NULL,
      resolvido_em INTEGER,
      fechado_em INTEGER
    );
    CREATE INDEX ix_chamados_status ON chamados(status, id);
    CREATE INDEX ix_chamados_agente ON chamados(agente_id, id);

    CREATE TABLE chamados_mensagens (
      id INTEGER PRIMARY KEY,
      chamado_id INTEGER NOT NULL REFERENCES chamados(id) ON DELETE CASCADE,
      autor_tipo TEXT NOT NULL,
      autor TEXT,
      texto TEXT NOT NULL,
      criado_em INTEGER NOT NULL
    );
    CREATE INDEX ix_chamados_mensagens ON chamados_mensagens(chamado_id, id);

    CREATE TABLE chamados_anexos (
      id INTEGER PRIMARY KEY,
      chamado_id INTEGER NOT NULL REFERENCES chamados(id) ON DELETE CASCADE,
      mensagem_id INTEGER REFERENCES chamados_mensagens(id) ON DELETE CASCADE,
      nome_arquivo TEXT NOT NULL,
      tipo TEXT NOT NULL,
      tamanho INTEGER NOT NULL,
      caminho TEXT NOT NULL,
      criado_em INTEGER NOT NULL
    );
    CREATE INDEX ix_chamados_anexos ON chamados_anexos(chamado_id);`,
  ],

  servico(ctx) {
    return {
      configBandeja: () => ({ ...configBandejaPadrao(), ...lerConfig(ctx.db, 'bandeja', {}) }),
      abertos(agenteId) {
        return ctx.db.prepare(`SELECT COUNT(*) AS n FROM chamados WHERE agente_id = ? AND status IN ('aberto','em_andamento','aguardando_usuario')`).get(agenteId).n;
      },
    };
  },

  rotas(app, ctx) {
    const { db, config } = ctx;
    const ver = ctx.exigir('chamados.ver');
    const responder = ctx.exigir('chamados.responder');

    function obter(id) {
      return db.prepare(`SELECT c.*, a.hostname, a.site_id, s.nome AS site_nome, s.cliente_id, cl.nome AS cliente_nome
        FROM chamados c JOIN agentes a ON a.id = c.agente_id JOIN sites s ON s.id = a.site_id JOIN clientes cl ON cl.id = s.cliente_id
        WHERE c.id = ?`).get(id);
    }

    function mensagens(id) {
      return db.prepare('SELECT * FROM chamados_mensagens WHERE chamado_id = ? ORDER BY id').all(id);
    }

    function anexos(id) {
      return db.prepare('SELECT id, chamado_id, mensagem_id, nome_arquivo, tipo, tamanho, criado_em FROM chamados_anexos WHERE chamado_id = ? ORDER BY id').all(id);
    }

    function notificarAgente(chamado, { usuario } = {}) {
      try {
        ctx.comandos.enviar(chamado.agente_id, 'chamados.notificar', { chamado_id: chamado.id, assunto: chamado.assunto },
          { usuario: usuario ?? null, fila: true, timeoutMs: 5000 });
      } catch { /* agente pode nem existir mais; não impede a resposta */ }
    }

    // =============================== API do painel ===============================
    app.get('/api/chamados', {
      preHandler: ver,
      schema: { querystring: { type: 'object', properties: {
        status: { type: 'string', enum: [...STATUS, 'abertos', 'todos'], default: 'abertos' },
        prioridade: { type: 'string', enum: PRIORIDADES },
        categoria: { type: 'string', enum: CATEGORIAS },
        tecnico: { type: 'string', maxLength: 120 },
        q: { type: 'string', maxLength: 200 },
        limite: { type: 'integer', minimum: 1, maximum: 1000, default: 300 },
        ...ESCOPO_QUERY,
      } } },
    }, async (req) => {
      const q = req.query;
      const f = filtroEscopo(q, 'a');
      const onde = [];
      const args = [];
      if (q.status === 'abertos') onde.push(`c.status IN (${ABERTOS.map(() => '?').join(',')})`), args.push(...ABERTOS);
      else if (q.status !== 'todos') { onde.push('c.status = ?'); args.push(q.status); }
      if (q.prioridade) { onde.push('c.prioridade = ?'); args.push(q.prioridade); }
      if (q.categoria) { onde.push('c.categoria = ?'); args.push(q.categoria); }
      if (q.tecnico) { onde.push('c.tecnico = ?'); args.push(q.tecnico); }
      if (q.q) { onde.push("(c.assunto LIKE ? ESCAPE '\\' OR a.hostname LIKE ? ESCAPE '\\')"); args.push(like(q.q), like(q.q)); }
      const where = `WHERE a.revogado = 0${onde.length ? ` AND ${onde.join(' AND ')}` : ''}${f.sql}`;
      const linhas = db.prepare(`SELECT c.*, a.hostname, a.site_id, s.nome AS site_nome, s.cliente_id
          FROM chamados c JOIN agentes a ON a.id = c.agente_id JOIN sites s ON s.id = a.site_id ${where}
        ORDER BY CASE c.prioridade WHEN 'urgente' THEN 0 WHEN 'alta' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END, c.id DESC
        LIMIT ?`).all(...args, ...f.args, q.limite);
      return linhas.map(linhaPublica);
    });

    app.get('/api/chamados/resumo', { preHandler: ver, schema: { querystring: { type: 'object', properties: { ...ESCOPO_QUERY } } } }, async (req) => {
      const f = filtroEscopo(req.query, 'a');
      const linhas = db.prepare(`SELECT c.status, COUNT(*) AS n FROM chamados c JOIN agentes a ON a.id = c.agente_id
        WHERE a.revogado = 0${f.sql} GROUP BY c.status`).all(...f.args);
      const porStatus = Object.fromEntries(STATUS.map((s) => [s, 0]));
      for (const l of linhas) porStatus[l.status] = l.n;
      const abertos = ABERTOS.reduce((t, s) => t + porStatus[s], 0);
      const urgentes = db.prepare(`SELECT COUNT(*) AS n FROM chamados c JOIN agentes a ON a.id = c.agente_id
        WHERE a.revogado = 0 AND c.prioridade = 'urgente' AND c.status IN (${ABERTOS.map(() => '?').join(',')})${f.sql}`).get(...ABERTOS, ...f.args).n;
      return { abertos, urgentes, porStatus };
    });

    app.get('/api/chamados/:id', { preHandler: ver, schema: { params: PARAMS_ID } }, async (req, reply) => {
      const c = obter(req.params.id);
      if (!c) return reply.code(404).send({ erro: 'Chamado não encontrado' });
      return { ...linhaPublica(c), dados_sistema: c.dados_sistema_json ? JSON.parse(c.dados_sistema_json) : null, mensagens: mensagens(c.id), anexos: anexos(c.id) };
    });

    app.put('/api/chamados/:id', {
      preHandler: responder,
      schema: { params: PARAMS_ID, body: { type: 'object', additionalProperties: false, minProperties: 1, properties: {
        status: { type: 'string', enum: STATUS }, prioridade: { type: 'string', enum: PRIORIDADES }, tecnico: { type: ['string', 'null'], maxLength: 120 },
      } } },
    }, async (req, reply) => {
      const c = obter(req.params.id);
      if (!c) return reply.code(404).send({ erro: 'Chamado não encontrado' });
      const b = req.body;
      const agora = Date.now();
      const sets = ['atualizado_em = ?'];
      const args = [agora];
      if (b.status) { sets.push('status = ?'); args.push(b.status); sets.push('resolvido_em = ?'); args.push(b.status === 'resolvido' ? agora : (b.status === 'fechado' ? c.resolvido_em ?? agora : null)); sets.push('fechado_em = ?'); args.push(b.status === 'fechado' ? agora : null); }
      if (b.prioridade) { sets.push('prioridade = ?'); args.push(b.prioridade); }
      if (b.tecnico !== undefined) { sets.push('tecnico = ?'); args.push(b.tecnico || null); }
      db.prepare(`UPDATE chamados SET ${sets.join(', ')} WHERE id = ?`).run(...args, c.id);
      ctx.auditarReq(req, 'chamado_alterado', { alvo: `chamado #${c.id} (${c.hostname})`, agente_id: c.agente_id, detalhes: b });
      ctx.emitir('chamado', { id: c.id, agente_id: c.agente_id, ...b }, { permissao: 'chamados.ver' });
      if (b.status === 'aguardando_usuario') notificarAgente(c, { usuario: req.sessao.usuario });
      return { ok: true };
    });

    app.post('/api/chamados/:id/mensagens', {
      preHandler: responder,
      schema: { params: PARAMS_ID, body: { type: 'object', required: ['texto'], additionalProperties: false, properties: {
        texto: { type: 'string', minLength: 1, maxLength: 8000 }, status: { type: 'string', enum: STATUS },
      } } },
    }, async (req, reply) => {
      const c = obter(req.params.id);
      if (!c) return reply.code(404).send({ erro: 'Chamado não encontrado' });
      const agora = Date.now();
      const novoStatus = req.body.status ?? (c.status === 'resolvido' || c.status === 'fechado' ? c.status : 'aguardando_usuario');
      const r = transacao(db, () => {
        const ins = db.prepare(`INSERT INTO chamados_mensagens (chamado_id, autor_tipo, autor, texto, criado_em) VALUES (?, 'tecnico', ?, ?, ?)`)
          .run(c.id, req.sessao.usuario, req.body.texto, agora);
        db.prepare(`UPDATE chamados SET status = ?, atualizado_em = ?, tecnico = COALESCE(tecnico, ?) WHERE id = ?`)
          .run(novoStatus, agora, req.sessao.usuario, c.id);
        return Number(ins.lastInsertRowid);
      });
      ctx.auditarReq(req, 'chamado_respondido', { alvo: `chamado #${c.id} (${c.hostname})`, agente_id: c.agente_id });
      ctx.emitir('chamado', { id: c.id, agente_id: c.agente_id, status: novoStatus, nova_mensagem: true }, { permissao: 'chamados.ver' });
      notificarAgente(c, { usuario: req.sessao.usuario });
      return { ok: true, mensagem_id: r };
    });

    app.get('/api/chamados/:id/anexos/:anexoId', { preHandler: ver, schema: { params: PARAMS_CHAMADO_ANEXO } }, async (req, reply) => {
      const a = db.prepare('SELECT * FROM chamados_anexos WHERE id = ? AND chamado_id = ?').get(req.params.anexoId, req.params.id);
      if (!a || !existsSync(a.caminho)) return reply.code(404).send({ erro: 'Anexo não encontrado' });
      return reply.type(a.tipo || 'application/octet-stream').send(readFileSync(a.caminho));
    });

    // ---------- Configuração da bandeja ----------
    app.get('/api/config/bandeja', { preHandler: ver }, async () => ctx.servicos.chamados.configBandeja());

    app.put('/api/config/bandeja', {
      preHandler: ctx.exigir('chamados.configurar'),
      schema: { body: { type: 'object', additionalProperties: false, properties: {
        empresa: { type: 'string', maxLength: 120 },
        cor: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' },
        icone_base64: { type: ['string', 'null'], maxLength: 200_000 },
        contato: { type: 'object', additionalProperties: false, properties: {
          telefone: { type: 'string', maxLength: 40 }, email: { type: 'string', maxLength: 150 }, site: { type: 'string', maxLength: 200 },
        } },
        recursos: { type: 'object', additionalProperties: false, properties: {
          chamados: { type: 'boolean' }, print: { type: 'boolean' }, acoesRapidas: { type: 'boolean' },
        } },
      } } },
    }, async (req) => {
      const atual = ctx.servicos.chamados.configBandeja();
      const novo = { ...atual, ...req.body, contato: { ...atual.contato, ...(req.body.contato || {}) }, recursos: { ...atual.recursos, ...(req.body.recursos || {}) } };
      definirConfig(db, 'bandeja', novo);
      ctx.auditarReq(req, 'bandeja_config_alterada', { alvo: 'bandeja do agente' });
      ctx.emitir('bandeja-config', novo, { permissao: 'chamados.ver' });
      return novo;
    });

    // =============================== API do agente (bandeja) ===============================
    // Tudo POST (como as demais rotas /api/agente/*: registrar, checkin, resultado) — a bandeja não tem o
    // segredo do agente; é a API local do agente (agente/farol/modulos/api_local.py) quem fala daqui pra
    // frente usando o cliente HTTP já autenticado do próprio agente (que só sabe fazer POST).
    const agente = { preHandler: ctx.autenticarAgente, config: ctx.limiteAgente() };
    const corpoAnexo = { anexo_base64: { type: 'string', maxLength: 7_000_000 }, anexo_tipo: { type: 'string', maxLength: 60 }, anexo_nome: { type: 'string', maxLength: 200 } };

    function pertenceAoAgente(id, agenteId) {
      const c = db.prepare('SELECT * FROM chamados WHERE id = ? AND agente_id = ?').get(id, agenteId);
      if (!c) throw Object.assign(new Error('Chamado não encontrado'), { statusCode: 404 });
      return c;
    }

    app.post('/api/agente/chamados/listar', {
      ...agente,
      schema: { body: { type: 'object', additionalProperties: false, properties: { usuario: { type: 'string', maxLength: 255 } } } },
    }, async (req) => {
      const u = req.body?.usuario || '';
      const linhas = db.prepare(`SELECT * FROM chamados WHERE agente_id = ?${u ? ' AND usuario_windows = ?' : ''} ORDER BY id DESC LIMIT 200`)
        .all(...(u ? [req.agente.id, u] : [req.agente.id]));
      return linhas.map((c) => ({ ...linhaPublica(c), ultima_mensagem: db.prepare('SELECT autor_tipo, texto, criado_em FROM chamados_mensagens WHERE chamado_id = ? ORDER BY id DESC LIMIT 1').get(c.id) ?? null }));
    });

    app.post('/api/agente/chamados/obter', { ...agente, schema: { body: { type: 'object', required: ['id'], additionalProperties: false, properties: { id: { type: 'integer', minimum: 1 } } } } }, async (req, reply) => {
      let c;
      try { c = pertenceAoAgente(req.body.id, req.agente.id); } catch (e) { return reply.code(e.statusCode).send({ erro: e.message }); }
      return { ...linhaPublica(c), mensagens: mensagens(c.id), anexos: anexos(c.id) };
    });

    app.post('/api/agente/chamados/criar', {
      ...agente,
      bodyLimit: 8 * 1024 * 1024,
      schema: { body: { type: 'object', required: ['assunto', 'descricao'], additionalProperties: false, properties: {
        assunto: { type: 'string', minLength: 1, maxLength: 200 },
        descricao: { type: 'string', minLength: 1, maxLength: 8000 },
        categoria: { type: 'string', enum: CATEGORIAS, default: 'outro' },
        prioridade: { type: 'string', enum: PRIORIDADES, default: 'normal' },
        usuario_windows: { type: ['string', 'null'], maxLength: 255 },
        dados_sistema: { type: ['object', 'null'] },
        ...corpoAnexo,
      } } },
    }, async (req, reply) => {
      const b = req.body;
      const agora = Date.now();
      let resultado;
      try {
        resultado = transacao(db, () => {
          const r = db.prepare(`INSERT INTO chamados (agente_id, usuario_windows, assunto, categoria, prioridade, status, dados_sistema_json, criado_em, atualizado_em)
            VALUES (?, ?, ?, ?, ?, 'aberto', ?, ?, ?)`)
            .run(req.agente.id, b.usuario_windows || null, b.assunto, b.categoria || 'outro', b.prioridade || 'normal', sistemaResumo(b.dados_sistema), agora, agora);
          const id = Number(r.lastInsertRowid);
          const m = db.prepare(`INSERT INTO chamados_mensagens (chamado_id, autor_tipo, autor, texto, criado_em) VALUES (?, 'usuario', ?, ?, ?)`)
            .run(id, b.usuario_windows || null, b.descricao, agora);
          if (b.anexo_base64) {
            const a = salvarAnexo(config, id, { base64: b.anexo_base64, tipo: b.anexo_tipo, nome: b.anexo_nome });
            db.prepare(`INSERT INTO chamados_anexos (chamado_id, mensagem_id, nome_arquivo, tipo, tamanho, caminho, criado_em) VALUES (?, ?, ?, ?, ?, ?, ?)`)
              .run(id, Number(m.lastInsertRowid), a.nome, a.tipo, a.tamanho, a.caminho, agora);
          }
          return { id };
        });
      } catch (e) {
        return reply.code(e.statusCode ?? 400).send({ erro: e.message });
      }
      ctx.auditar({ usuario: b.usuario_windows || null, acao: 'chamado_aberto', alvo: `chamado #${resultado.id}: ${b.assunto}`, agente_id: req.agente.id, ip: req.ip });
      ctx.emitir('chamado', { id: resultado.id, agente_id: req.agente.id, status: 'aberto', novo: true }, { permissao: 'chamados.ver' });
      return reply.code(201).send({ id: resultado.id });
    });

    app.post('/api/agente/chamados/responder', {
      ...agente,
      bodyLimit: 8 * 1024 * 1024,
      schema: { body: { type: 'object', required: ['id', 'texto'], additionalProperties: false, properties: {
        id: { type: 'integer', minimum: 1 },
        texto: { type: 'string', minLength: 1, maxLength: 8000 },
        usuario_windows: { type: ['string', 'null'], maxLength: 255 },
        ...corpoAnexo,
      } } },
    }, async (req, reply) => {
      let c;
      try { c = pertenceAoAgente(req.body.id, req.agente.id); } catch (e) { return reply.code(e.statusCode).send({ erro: e.message }); }
      const agora = Date.now();
      const b = req.body;
      try {
        transacao(db, () => {
          const m = db.prepare(`INSERT INTO chamados_mensagens (chamado_id, autor_tipo, autor, texto, criado_em) VALUES (?, 'usuario', ?, ?, ?)`)
            .run(c.id, b.usuario_windows || null, b.texto, agora);
          if (b.anexo_base64) {
            const a = salvarAnexo(config, c.id, { base64: b.anexo_base64, tipo: b.anexo_tipo, nome: b.anexo_nome });
            db.prepare(`INSERT INTO chamados_anexos (chamado_id, mensagem_id, nome_arquivo, tipo, tamanho, caminho, criado_em) VALUES (?, ?, ?, ?, ?, ?, ?)`)
              .run(c.id, Number(m.lastInsertRowid), a.nome, a.tipo, a.tamanho, a.caminho, agora);
          }
          const novoStatus = c.status === 'resolvido' || c.status === 'fechado' ? 'em_andamento' : (c.status === 'aguardando_usuario' ? 'em_andamento' : c.status);
          db.prepare('UPDATE chamados SET status = ?, atualizado_em = ? WHERE id = ?').run(novoStatus, agora, c.id);
        });
      } catch (e) {
        return reply.code(e.statusCode ?? 400).send({ erro: e.message });
      }
      ctx.auditar({ usuario: b.usuario_windows || null, acao: 'chamado_respondido', alvo: `chamado #${c.id}`, agente_id: req.agente.id, ip: req.ip });
      ctx.emitir('chamado', { id: c.id, agente_id: req.agente.id, nova_mensagem: true }, { permissao: 'chamados.ver' });
      return { ok: true };
    });

    app.post('/api/agente/chamados/fechar', { ...agente, schema: { body: { type: 'object', required: ['id'], additionalProperties: false, properties: { id: { type: 'integer', minimum: 1 } } } } }, async (req, reply) => {
      let c;
      try { c = pertenceAoAgente(req.body.id, req.agente.id); } catch (e) { return reply.code(e.statusCode).send({ erro: e.message }); }
      const agora = Date.now();
      db.prepare("UPDATE chamados SET status = 'fechado', fechado_em = ?, atualizado_em = ? WHERE id = ?").run(agora, agora, c.id);
      ctx.emitir('chamado', { id: c.id, agente_id: req.agente.id, status: 'fechado' }, { permissao: 'chamados.ver' });
      return { ok: true };
    });

    // Anexo devolvido em base64 dentro do JSON (a bandeja não fala binário com o agente): simples e sem
    // precisar de outro verbo HTTP no cliente do agente (que só tem .post()).
    app.post('/api/agente/chamados/anexo', {
      ...agente,
      schema: { body: { type: 'object', required: ['id', 'anexo_id'], additionalProperties: false, properties: { id: { type: 'integer', minimum: 1 }, anexo_id: { type: 'integer', minimum: 1 } } } },
    }, async (req, reply) => {
      try { pertenceAoAgente(req.body.id, req.agente.id); } catch (e) { return reply.code(e.statusCode).send({ erro: e.message }); }
      const a = db.prepare('SELECT * FROM chamados_anexos WHERE id = ? AND chamado_id = ?').get(req.body.anexo_id, req.body.id);
      if (!a || !existsSync(a.caminho)) return reply.code(404).send({ erro: 'Anexo não encontrado' });
      return { nome_arquivo: a.nome_arquivo, tipo: a.tipo, tamanho: a.tamanho, conteudo_base64: readFileSync(a.caminho).toString('base64') };
    });

    app.post('/api/agente/bandeja/config', { ...agente }, async () => ctx.servicos.chamados.configBandeja());
  },
};
