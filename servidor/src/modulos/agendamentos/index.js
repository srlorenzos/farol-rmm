// Agendamentos (jobs agendados): roda um script num alvo (agente/site/cliente/todos/grupo) de tempo em
// tempo ("a cada N minutos") ou numa expressão cron. Nunca duplica a entrega ao agente — sempre chama
// ctx.servicos.jobs.executar(), a mesma função por trás de POST /api/executar manual (ver jobs/index.js).
// Cada disparo automático é auditado com uma ação própria (agendamento_disparado), separada da auditoria
// de execução manual (script_executado), pra ficar claro o que rodou sozinho.
import { PARAMS_ID, ALVO_SCHEMA, ID_AGENTE, filtroEscopo, ESCOPO_QUERY } from '../../nucleo/util.js';
import { compilarCron, proximaExecucaoCron } from './cron.js';

const TIPOS = ['intervalo', 'cron'];
const MIN_INTERVALO_MIN = 1;
const MAX_INTERVALO_MIN = 10_080; // 7 dias

function calcularProxima(tipo, { intervaloMin, cron }, apartirDeMs) {
  if (tipo === 'intervalo') return apartirDeMs + intervaloMin * 60_000;
  const compilado = compilarCron(cron); // já validado na criação/edição, mas o cron pode ter ficado "impossível" só em casos extremos
  return proximaExecucaoCron(compilado, apartirDeMs);
}

function linhaPublica(a) {
  return {
    id: a.id, nome: a.nome, script_id: a.script_id, biblioteca_id: a.biblioteca_id,
    variaveis: a.variaveis_json ? JSON.parse(a.variaveis_json) : {}, timeout: a.timeout,
    alvo: JSON.parse(a.alvo_json), tipo: a.tipo, intervalo_min: a.intervalo_min, cron: a.cron,
    ativo: !!a.ativo, proxima_execucao: a.proxima_execucao, ultima_execucao: a.ultima_execucao, ultimo_lote: a.ultimo_lote,
    criado_por: a.criado_por, criado_em: a.criado_em,
  };
}

/** Atalho: mesma resolução de jobs.resolverScript(), só que já aceitando o formato {script_id, biblioteca_id} usado aqui. */
function obterScript(ctx, { script_id, biblioteca_id }) {
  return ctx.servicos.jobs.resolverScript({ script_id, biblioteca_id });
}

/** Dispara um agendamento: cria os jobs (reaproveitando jobs.executar), grava o disparo e a auditoria,
 * e sempre recalcula a próxima execução (mesmo em erro — um script apagado não deve travar o agendamento
 * pra sempre; ele continua tentando e aparecendo com erro no histórico até alguém corrigir ou pausar). */
async function dispararAgendamento(ctx, ag, agora) {
  const { db } = ctx;
  let lote = null, nJobs = 0, erro = null;
  try {
    const { script, erro: erroScript } = await obterScript(ctx, ag);
    if (erroScript) throw new Error(erroScript);
    const variaveis = ag.variaveis_json ? JSON.parse(ag.variaveis_json) : {};
    const alvo = JSON.parse(ag.alvo_json);
    const r = await ctx.servicos.jobs.executar({ script, variaveisExtra: variaveis, timeoutOverride: ag.timeout || undefined, alvo, criadoPor: ag.criado_por });
    lote = r.lote;
    nJobs = r.jobs.length;
  } catch (e) {
    erro = String(e?.message ?? e).slice(0, 500);
  }
  db.prepare('INSERT INTO agendamentos_disparos (agendamento_id, disparado_em, lote, n_jobs, erro) VALUES (?, ?, ?, ?, ?)').run(ag.id, agora, lote, nJobs, erro);
  db.prepare('UPDATE agendamentos SET ultima_execucao = ?, ultimo_lote = COALESCE(?, ultimo_lote) WHERE id = ?').run(agora, lote, ag.id);
  ctx.auditar({
    usuario: ag.criado_por, acao: erro ? 'agendamento_falhou' : 'agendamento_disparado', alvo: ag.nome,
    detalhes: { agendamento_id: ag.id, lote, jobs: nJobs, automatico: true, ...(erro ? { erro } : {}) },
  });
  ctx.emitir('agendamento', { id: ag.id, nome: ag.nome, disparado_em: agora, jobs: nJobs, erro });

  let proxima = null;
  try { proxima = calcularProxima(ag.tipo, { intervaloMin: ag.intervalo_min, cron: ag.cron }, agora + 1); } catch { /* cron ficou inválido */ }
  if (proxima == null) db.prepare('UPDATE agendamentos SET ativo = 0, proxima_execucao = NULL WHERE id = ?').run(ag.id);
  else db.prepare('UPDATE agendamentos SET proxima_execucao = ? WHERE id = ?').run(proxima, ag.id);
}

export default {
  nome: 'agendamentos',
  descricao: 'Jobs agendados (cron / intervalo) por agente, site, cliente ou grupo',
  depende: ['agentes', 'scripts', 'biblioteca', 'jobs'],
  permissoes: {
    'agendamentos.ver': { descricao: 'Ver agendamentos e seu histórico de disparos', papeis: ['tecnico', 'leitura'] },
    'agendamentos.gerenciar': { descricao: 'Criar, editar, pausar e excluir agendamentos (exige 2FA)', papeis: ['tecnico'] },
  },

  migracoes: [
    `CREATE TABLE agendamentos (
      id INTEGER PRIMARY KEY,
      nome TEXT NOT NULL,
      script_id INTEGER,
      biblioteca_id TEXT,
      variaveis_json TEXT,
      timeout INTEGER,
      alvo_json TEXT NOT NULL,
      tipo TEXT NOT NULL,
      intervalo_min INTEGER,
      cron TEXT,
      ativo INTEGER NOT NULL DEFAULT 1,
      proxima_execucao INTEGER,
      ultima_execucao INTEGER,
      ultimo_lote TEXT,
      criado_por TEXT NOT NULL,
      criado_em INTEGER NOT NULL
    );
    CREATE INDEX ix_agendamentos_proxima ON agendamentos(ativo, proxima_execucao);
    CREATE TABLE agendamentos_disparos (
      id INTEGER PRIMARY KEY,
      agendamento_id INTEGER NOT NULL REFERENCES agendamentos(id) ON DELETE CASCADE,
      disparado_em INTEGER NOT NULL,
      lote TEXT,
      n_jobs INTEGER NOT NULL DEFAULT 0,
      erro TEXT
    );
    CREATE INDEX ix_agendamentos_disparos ON agendamentos_disparos(agendamento_id, id DESC);`,
  ],

  aoIniciar(ctx) {
    // Roda a cada 20 s: baldes de 1 min no cron já tem folga de sobra pra não perder um disparo.
    ctx.agendador.registrar('agendamentos.disparar', 20_000, async (c, agora) => {
      const pendentes = c.db.prepare('SELECT * FROM agendamentos WHERE ativo = 1 AND proxima_execucao IS NOT NULL AND proxima_execucao <= ?').all(agora);
      for (const ag of pendentes) await dispararAgendamento(c, ag, agora);
    });
    // Disparos velhos não precisam viver pra sempre.
    ctx.agendador.registrar('agendamentos.limpeza', 3600_000, ({ db }, agora) => {
      db.prepare('DELETE FROM agendamentos_disparos WHERE disparado_em < ?').run(agora - 90 * 86_400_000);
    });
  },

  rotas(app, ctx) {
    const { db } = ctx;
    const ver = ctx.exigir('agendamentos.ver');
    const gerenciar = ctx.exigir('agendamentos.gerenciar', { elevado: true });

    const corpoBase = {
      nome: { type: 'string', minLength: 1, maxLength: 150 },
      script_id: { type: 'integer', minimum: 1 },
      biblioteca_id: { type: 'string', pattern: '^[a-z0-9][a-z0-9-]{0,79}$' },
      variaveis: { type: 'object', maxProperties: 30, additionalProperties: { type: ['string', 'number', 'boolean', 'null'] } },
      timeout: { type: 'integer', minimum: 5, maximum: 86_400 },
      alvo: ALVO_SCHEMA,
      tipo: { type: 'string', enum: TIPOS },
      intervalo_min: { type: 'integer', minimum: MIN_INTERVALO_MIN, maximum: MAX_INTERVALO_MIN },
      cron: { type: 'string', maxLength: 100 },
    };

    app.get('/api/agendamentos', {
      preHandler: ver,
      schema: { querystring: { type: 'object', properties: { ativo: { type: 'boolean' } } } },
    }, async (req) => {
      let linhas = db.prepare('SELECT * FROM agendamentos ORDER BY nome COLLATE NOCASE').all();
      if (req.query.ativo !== undefined) linhas = linhas.filter((a) => !!a.ativo === req.query.ativo);
      return linhas.map(linhaPublica);
    });

    app.get('/api/agendamentos/:id', { preHandler: ver, schema: { params: PARAMS_ID } }, async (req, reply) => {
      const a = db.prepare('SELECT * FROM agendamentos WHERE id = ?').get(req.params.id);
      if (!a) return reply.code(404).send({ erro: 'Agendamento não encontrado' });
      const disparos = db.prepare('SELECT id, disparado_em, lote, n_jobs, erro FROM agendamentos_disparos WHERE agendamento_id = ? ORDER BY id DESC LIMIT 50').all(a.id);
      return { ...linhaPublica(a), disparos };
    });

    app.post('/api/agendamentos', {
      preHandler: gerenciar,
      schema: { body: { type: 'object', additionalProperties: false, required: ['nome', 'alvo', 'tipo'], properties: corpoBase } },
    }, async (req, reply) => {
      const b = req.body;
      if (!b.script_id && !b.biblioteca_id) return reply.code(400).send({ erro: 'Informe script_id ou biblioteca_id' });
      if (b.script_id && b.biblioteca_id) return reply.code(400).send({ erro: 'Informe só um: script_id ou biblioteca_id' });
      const { script, erro } = await obterScript(ctx, b);
      if (erro) return reply.code(404).send({ erro });
      if (b.tipo === 'intervalo' && !b.intervalo_min) return reply.code(400).send({ erro: 'Informe intervalo_min pro tipo "intervalo"' });
      if (b.tipo === 'cron' && !b.cron) return reply.code(400).send({ erro: 'Informe cron pro tipo "cron"' });
      let proxima;
      try {
        proxima = calcularProxima(b.tipo, { intervaloMin: b.intervalo_min, cron: b.cron }, Date.now());
      } catch (e) { return reply.code(400).send({ erro: e.message }); }
      if (proxima == null) return reply.code(400).send({ erro: 'Essa expressão cron nunca bate com nenhuma data nos próximos 2 anos' });
      // Alvo precisa resolver pelo menos uma vez pra não criar um agendamento morto por engano.
      let resolvidos;
      try { resolvidos = await ctx.alvos.resolver(b.alvo); } catch (e) { return reply.code(400).send({ erro: e.message }); }
      if (!resolvidos.length) return reply.code(400).send({ erro: 'Nenhum dispositivo no alvo escolhido' });

      const agora = Date.now();
      const r = db.prepare(`INSERT INTO agendamentos (nome, script_id, biblioteca_id, variaveis_json, timeout, alvo_json, tipo, intervalo_min, cron, ativo, proxima_execucao, criado_por, criado_em)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`)
        .run(b.nome, b.script_id ?? null, b.biblioteca_id ?? null, Object.keys(b.variaveis ?? {}).length ? JSON.stringify(b.variaveis) : null,
          b.timeout ?? null, JSON.stringify(b.alvo), b.tipo, b.intervalo_min ?? null, b.cron ?? null, proxima, req.sessao.usuario, agora);
      const id = Number(r.lastInsertRowid);
      ctx.auditarReq(req, 'agendamento_criado', { alvo: b.nome, detalhes: { id, script: script.nome, tipo: b.tipo, alvo: b.alvo } });
      ctx.emitir('agendamento', { id, criado: true });
      return reply.code(201).send(linhaPublica(db.prepare('SELECT * FROM agendamentos WHERE id = ?').get(id)));
    });

    app.put('/api/agendamentos/:id', {
      preHandler: gerenciar,
      schema: { params: PARAMS_ID, body: { type: 'object', additionalProperties: false, minProperties: 1, properties: corpoBase } },
    }, async (req, reply) => {
      const atual = db.prepare('SELECT * FROM agendamentos WHERE id = ?').get(req.params.id);
      if (!atual) return reply.code(404).send({ erro: 'Agendamento não encontrado' });
      const b = req.body;
      const novo = {
        nome: b.nome ?? atual.nome,
        script_id: b.script_id !== undefined ? b.script_id : atual.script_id,
        biblioteca_id: b.biblioteca_id !== undefined ? b.biblioteca_id : atual.biblioteca_id,
        variaveis_json: b.variaveis !== undefined ? (Object.keys(b.variaveis).length ? JSON.stringify(b.variaveis) : null) : atual.variaveis_json,
        timeout: b.timeout !== undefined ? b.timeout : atual.timeout,
        alvo_json: b.alvo !== undefined ? JSON.stringify(b.alvo) : atual.alvo_json,
        tipo: b.tipo ?? atual.tipo,
        intervalo_min: b.intervalo_min !== undefined ? b.intervalo_min : atual.intervalo_min,
        cron: b.cron !== undefined ? b.cron : atual.cron,
      };
      if (b.script_id && b.biblioteca_id) return reply.code(400).send({ erro: 'Informe só um: script_id ou biblioteca_id' });
      if (b.script_id) novo.biblioteca_id = null;
      if (b.biblioteca_id) novo.script_id = null;
      if (!novo.script_id && !novo.biblioteca_id) return reply.code(400).send({ erro: 'Agendamento precisa de um script' });
      const { erro } = await obterScript(ctx, novo);
      if (erro) return reply.code(404).send({ erro });
      let proxima;
      try {
        proxima = calcularProxima(novo.tipo, { intervaloMin: novo.intervalo_min, cron: novo.cron }, Date.now());
      } catch (e) { return reply.code(400).send({ erro: e.message }); }
      if (proxima == null) return reply.code(400).send({ erro: 'Essa expressão cron nunca bate com nenhuma data nos próximos 2 anos' });

      db.prepare(`UPDATE agendamentos SET nome = ?, script_id = ?, biblioteca_id = ?, variaveis_json = ?, timeout = ?, alvo_json = ?,
          tipo = ?, intervalo_min = ?, cron = ?, proxima_execucao = ? WHERE id = ?`)
        .run(novo.nome, novo.script_id, novo.biblioteca_id, novo.variaveis_json, novo.timeout, novo.alvo_json,
          novo.tipo, novo.intervalo_min, novo.cron, proxima, atual.id);
      ctx.auditarReq(req, 'agendamento_alterado', { alvo: novo.nome, detalhes: { id: atual.id, ...b } });
      ctx.emitir('agendamento', { id: atual.id, alterado: true });
      return linhaPublica(db.prepare('SELECT * FROM agendamentos WHERE id = ?').get(atual.id));
    });

    app.post('/api/agendamentos/:id/pausar', { preHandler: gerenciar, schema: { params: PARAMS_ID } }, async (req, reply) => {
      const a = db.prepare('SELECT id, nome FROM agendamentos WHERE id = ?').get(req.params.id);
      if (!a) return reply.code(404).send({ erro: 'Agendamento não encontrado' });
      db.prepare('UPDATE agendamentos SET ativo = 0 WHERE id = ?').run(a.id);
      ctx.auditarReq(req, 'agendamento_pausado', { alvo: a.nome, detalhes: { id: a.id } });
      ctx.emitir('agendamento', { id: a.id, ativo: false });
      return { ok: true };
    });

    app.post('/api/agendamentos/:id/retomar', { preHandler: gerenciar, schema: { params: PARAMS_ID } }, async (req, reply) => {
      const a = db.prepare('SELECT * FROM agendamentos WHERE id = ?').get(req.params.id);
      if (!a) return reply.code(404).send({ erro: 'Agendamento não encontrado' });
      let proxima;
      try { proxima = calcularProxima(a.tipo, { intervaloMin: a.intervalo_min, cron: a.cron }, Date.now()); } catch { proxima = null; }
      if (proxima == null) return reply.code(400).send({ erro: 'Não foi possível calcular a próxima execução (expressão cron inválida?)' });
      db.prepare('UPDATE agendamentos SET ativo = 1, proxima_execucao = ? WHERE id = ?').run(proxima, a.id);
      ctx.auditarReq(req, 'agendamento_retomado', { alvo: a.nome, detalhes: { id: a.id, proxima_execucao: proxima } });
      ctx.emitir('agendamento', { id: a.id, ativo: true });
      return { ok: true, proxima_execucao: proxima };
    });

    app.delete('/api/agendamentos/:id', { preHandler: gerenciar, schema: { params: PARAMS_ID } }, async (req, reply) => {
      const a = db.prepare('SELECT id, nome FROM agendamentos WHERE id = ?').get(req.params.id);
      if (!a) return reply.code(404).send({ erro: 'Agendamento não encontrado' });
      db.prepare('DELETE FROM agendamentos WHERE id = ?').run(a.id);
      ctx.auditarReq(req, 'agendamento_excluido', { alvo: a.nome, detalhes: { id: a.id } });
      ctx.emitir('agendamento', { id: a.id, excluido: true });
      return { ok: true };
    });
  },
};
