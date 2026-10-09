// Execuções (jobs): rodar um script do usuário, um script da biblioteca ou um comando rápido em um alvo.
// Entrega na resposta do check-in (gancho tarefasAgente); se o agente tem canal em tempo real, ele é
// "acordado" na hora para buscar o job. Variáveis viram FAROL_<NOME> no ambiente do processo.
import { randomUUID } from 'node:crypto';
import { transacao } from '../../db.js';
import { PARAMS_ID, PARAMS_AGENTE, ID_AGENTE, ALVO_SCHEMA, MAX_SAIDA, truncar, filtroEscopo, ESCOPO_QUERY } from '../../nucleo/util.js';
import { montarAmbiente, ambienteParaAuditoria } from '../../nucleo/variaveis.js';
import { SHELLS } from '../scripts/index.js';

const FINAIS = ['sucesso', 'falha', 'timeout', 'expirado', 'cancelado'];
const txt = (max) => ({ type: 'string', maxLength: max });

/** Nome do SO do agente → chave usada nos scripts. */
export function soDoAgente(so) {
  const s = String(so ?? '').toLowerCase();
  if (s.startsWith('win')) return 'windows';
  if (s === 'darwin' || s.startsWith('mac')) return 'macos';
  if (s) return 'linux';
  return null;
}

/** Lê "FAROL_STATUS: ok|alerta|critico <mensagem>" da última linha que tiver o marcador (scripts tipo monitor). */
export function lerStatusMonitor(stdout) {
  const linhas = String(stdout ?? '').split(/\r?\n/).reverse();
  for (const l of linhas) {
    const m = /^\s*FAROL_STATUS:\s*(ok|alerta|critico)\b\s*(.*)$/i.exec(l);
    if (m) return { status: m[1].toLowerCase(), mensagem: m[2].trim().slice(0, 500) };
  }
  return null;
}

export default {
  nome: 'jobs',
  descricao: 'Execução de scripts e comandos nos dispositivos',
  depende: ['agentes', 'scripts', 'biblioteca'],
  permissoes: {
    'scripts.executar': { descricao: 'Executar scripts e comandos nos dispositivos (exige 2FA)', papeis: ['tecnico'] },
    'jobs.ver': { descricao: 'Ver execuções e suas saídas', papeis: ['tecnico', 'leitura'] },
  },
  migracoes: [
    // 1 — tabela da v1
    `CREATE TABLE IF NOT EXISTS jobs (
      id INTEGER PRIMARY KEY,
      agente_id TEXT NOT NULL REFERENCES agentes(id) ON DELETE CASCADE,
      script_id INTEGER,
      nome TEXT NOT NULL,
      shell TEXT NOT NULL,
      conteudo TEXT NOT NULL,
      timeout INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pendente',
      criado_por TEXT NOT NULL,
      criado_em INTEGER NOT NULL,
      enviado_em INTEGER,
      concluido_em INTEGER,
      codigo_saida INTEGER,
      stdout TEXT, stderr TEXT,
      duracao_ms INTEGER
    );
    CREATE INDEX IF NOT EXISTS ix_jobs_agente ON jobs(agente_id, status);`,
    // 2 — v2: lote, origem, ambiente (variáveis), status de monitor
    `ALTER TABLE jobs ADD COLUMN lote TEXT;
    ALTER TABLE jobs ADD COLUMN origem TEXT;
    ALTER TABLE jobs ADD COLUMN env_json TEXT;
    ALTER TABLE jobs ADD COLUMN tipo TEXT NOT NULL DEFAULT 'acao';
    ALTER TABLE jobs ADD COLUMN monitor_status TEXT;
    ALTER TABLE jobs ADD COLUMN monitor_msg TEXT;
    CREATE INDEX ix_jobs_lote ON jobs(lote);
    CREATE INDEX ix_jobs_criado ON jobs(criado_em);`,
  ],

  tarefasAgente(agente, ctx) {
    const { db } = ctx;
    const agora = Date.now();
    const jobs = transacao(db, () => {
      const pend = db.prepare(`SELECT id, shell, conteudo, timeout, env_json FROM jobs
        WHERE agente_id = ? AND status = 'pendente' ORDER BY id LIMIT 10`).all(agente.id);
      // O ambiente pode ter senhas: é apagado do banco assim que o job é entregue.
      const marcar = db.prepare("UPDATE jobs SET status = 'enviado', enviado_em = ?, env_json = NULL WHERE id = ?");
      for (const j of pend) marcar.run(agora, j.id);
      return pend;
    });
    for (const j of jobs) ctx.emitir('job', { id: j.id, agente_id: agente.id, status: 'enviado' });
    return { jobs: jobs.map(({ env_json, ...j }) => (env_json ? { ...j, env: JSON.parse(env_json) } : j)) };
  },

  aoIniciar(ctx) {
    ctx.agendador.registrar('jobs.expirados', 10_000, ({ db }, agora) => {
      // Job enviado que não voltou dentro do timeout + 2 min de folga é marcado como expirado.
      const expirados = db.prepare(`SELECT id, agente_id FROM jobs
        WHERE status = 'enviado' AND enviado_em + (timeout * 1000) + 120000 < ?`).all(agora);
      for (const j of expirados) {
        db.prepare("UPDATE jobs SET status = 'expirado', concluido_em = ? WHERE id = ?").run(agora, j.id);
        ctx.emitir('job', { id: j.id, agente_id: j.agente_id, status: 'expirado' });
      }
    });
    ctx.agendador.registrar('jobs.limpeza', 3600_000, ({ db, config }, agora) => {
      db.prepare('DELETE FROM jobs WHERE criado_em < ? AND status IN (' + FINAIS.map(() => '?').join(',') + ')')
        .run(agora - config.retencaoJobsDias * 86400_000, ...FINAIS);
      // pendentes há mais de 7 dias (agente sumiu) são cancelados
      db.prepare("UPDATE jobs SET status = 'cancelado', env_json = NULL WHERE status = 'pendente' AND criado_em < ?").run(agora - 7 * 86400_000);
    }, { imediato: true });
  },

  rotas(app, ctx) {
    const { db } = ctx;
    const ver = ctx.exigir('jobs.ver');

    app.post('/api/executar', {
      preHandler: ctx.exigir('scripts.executar', { elevado: true }),
      schema: { body: {
        type: 'object', additionalProperties: false,
        properties: {
          agentes: { type: 'array', minItems: 1, maxItems: 5000, uniqueItems: true, items: ID_AGENTE },
          alvo: ALVO_SCHEMA,
          script_id: { type: 'integer', minimum: 1 },
          biblioteca_id: { type: 'string', pattern: '^[a-z0-9][a-z0-9-]{0,79}$' },
          comando: { type: 'string', minLength: 1, maxLength: 20_000 },
          shell: { type: 'string', enum: SHELLS },
          timeout: { type: 'integer', minimum: 5, maximum: 3600 },
          variaveis: { type: 'object', maxProperties: 30, additionalProperties: { type: ['string', 'number', 'boolean', 'null'] } },
        },
      } },
    }, async (req, reply) => {
      const b = req.body;
      let script;
      if (b.script_id) {
        script = ctx.servicos.scripts.obter(b.script_id);
        if (!script) return reply.code(404).send({ erro: 'Script não encontrado' });
        script = { ...script, origem: `script:${script.id}` };
      } else if (b.biblioteca_id) {
        const item = ctx.servicos.biblioteca.obter(b.biblioteca_id);
        if (!item) return reply.code(404).send({ erro: 'Script não encontrado na biblioteca' });
        script = { ...item, timeout: item.tempo_limite, origem: `biblioteca:${item.id}` };
      } else if (b.comando && b.shell) {
        script = { nome: `Comando: ${b.comando.split('\n')[0].slice(0, 60)}`, shell: b.shell, conteudo: b.comando, timeout: 60,
          so: null, tipo: 'acao', variaveis: [], origem: 'comando' };
      } else {
        return reply.code(400).send({ erro: 'Informe script_id, biblioteca_id ou comando + shell' });
      }
      const env = montarAmbiente(script.variaveis, b.variaveis ?? {});
      const timeout = b.timeout ?? script.timeout ?? 60;

      if (!b.alvo && !b.agentes) return reply.code(400).send({ erro: 'Informe o alvo (alvo ou agentes)' });
      const resolvidos = await ctx.alvos.resolver(b.alvo ?? { tipo: 'agente', id: b.agentes });
      if (b.agentes && resolvidos.length !== b.agentes.length) return reply.code(400).send({ erro: 'Agente inexistente ou revogado na seleção' });
      if (!resolvidos.length) return reply.code(400).send({ erro: 'Nenhum dispositivo no alvo' });
      const ignorados = [];
      const alvos = resolvidos.filter((a) => {
        const so = soDoAgente(a.so);
        if (script.so && so && !script.so.includes(so)) { ignorados.push({ id: a.id, hostname: a.hostname, motivo: `script não é para ${so}` }); return false; }
        return true;
      });
      if (!alvos.length) return reply.code(400).send({ erro: 'O script não é compatível com o sistema dos dispositivos do alvo', ignorados });

      const agora = Date.now();
      const lote = randomUUID();
      const envJson = Object.keys(env).length ? JSON.stringify(env) : null;
      const ins = db.prepare(`INSERT INTO jobs (agente_id, script_id, nome, shell, conteudo, timeout, status, criado_por, criado_em, lote, origem, env_json, tipo)
        VALUES (?, ?, ?, ?, ?, ?, 'pendente', ?, ?, ?, ?, ?, ?)`);
      const jobs = transacao(db, () => alvos.map((a) => {
        const r = ins.run(a.id, b.script_id ?? null, script.nome, script.shell, script.conteudo, timeout, req.sessao.usuario, agora, lote, script.origem, envJson, script.tipo ?? 'acao');
        return { id: Number(r.lastInsertRowid), agente_id: a.id, hostname: a.hostname };
      }));
      ctx.auditarReq(req, b.comando ? 'comando_executado' : 'script_executado', {
        alvo: alvos.length > 20 ? `${alvos.length} dispositivos` : alvos.map((a) => a.hostname).join(', '),
        agente_id: alvos.length === 1 ? alvos[0].id : null,
        detalhes: { nome: script.nome, shell: script.shell, origem: script.origem, lote, alvo: b.alvo ?? null, jobs: jobs.slice(0, 50).map((j) => j.id),
          ...(Object.keys(env).length ? { variaveis: ambienteParaAuditoria(script.variaveis, env) } : {}),
          ...(b.comando ? { comando: script.conteudo.slice(0, 500) } : {}) },
      });
      for (const j of jobs) {
        ctx.emitir('job', { ...j, nome: script.nome, status: 'pendente', criado_em: agora, criado_por: req.sessao.usuario, lote });
        ctx.canalAgentes.acordar(j.agente_id);
      }
      return { lote, jobs, ignorados };
    });

    app.post('/api/agente/resultado', {
      preHandler: ctx.autenticarAgente,
      config: ctx.limiteAgente(),
      schema: { body: { type: 'object', required: ['job_id'], additionalProperties: false, properties: {
        job_id: { type: 'integer', minimum: 1 },
        codigo_saida: { type: ['integer', 'null'] },
        stdout: txt(MAX_SAIDA + 1024), stderr: txt(MAX_SAIDA + 1024),
        duracao_ms: { type: ['number', 'null'] },
        erro: { type: ['string', 'null'], maxLength: 500 },
        timeout: { type: 'boolean' },
      } } },
    }, async (req, reply) => {
      const b = req.body;
      const job = db.prepare('SELECT * FROM jobs WHERE id = ? AND agente_id = ?').get(b.job_id, req.agente.id);
      if (!job) return reply.code(404).send({ erro: 'Job não encontrado' });
      if (!['enviado', 'pendente'].includes(job.status)) return reply.code(409).send({ erro: 'Job já finalizado' });
      const status = b.timeout ? 'timeout' : (b.erro || b.codigo_saida !== 0 ? 'falha' : 'sucesso');
      const stderr = [b.stderr, b.erro ? `[agente] ${b.erro}` : null].filter(Boolean).join('\n');
      const monitor = job.tipo === 'monitor' ? lerStatusMonitor(b.stdout) : null;
      const agora = Date.now();
      db.prepare(`UPDATE jobs SET status = ?, codigo_saida = ?, stdout = ?, stderr = ?, duracao_ms = ?, concluido_em = ?,
          monitor_status = ?, monitor_msg = ?, env_json = NULL WHERE id = ?`)
        .run(status, b.codigo_saida ?? null, truncar(b.stdout), truncar(stderr), b.duracao_ms ?? null, agora,
          monitor?.status ?? null, monitor?.mensagem ?? null, job.id);
      ctx.emitir('job', { id: job.id, agente_id: req.agente.id, hostname: req.agente.hostname, nome: job.nome, status,
        codigo_saida: b.codigo_saida ?? null, concluido_em: agora, monitor_status: monitor?.status ?? null, lote: job.lote });
      return { ok: true };
    });

    const COLS = `j.id, j.nome, j.shell, j.status, j.criado_por, j.criado_em, j.enviado_em, j.concluido_em, j.codigo_saida, j.duracao_ms,
      j.lote, j.origem, j.tipo, j.monitor_status, j.monitor_msg, a.hostname, a.id AS agente_id`;

    app.get('/api/jobs', {
      preHandler: ver,
      schema: { querystring: { type: 'object', properties: {
        limite: { type: 'integer', minimum: 1, maximum: 500, default: 50 },
        status: { type: 'string', enum: ['pendente', 'enviado', ...FINAIS] },
        lote: { type: 'string', maxLength: 36 },
        ...ESCOPO_QUERY,
      } } },
    }, async (req) => {
      const f = filtroEscopo(req.query);
      const onde = [];
      const args = [];
      if (req.query.status) { onde.push('j.status = ?'); args.push(req.query.status); }
      if (req.query.lote) { onde.push('j.lote = ?'); args.push(req.query.lote); }
      return db.prepare(`SELECT ${COLS} FROM jobs j JOIN agentes a ON a.id = j.agente_id
        WHERE 1 = 1${onde.map((o) => ` AND ${o}`).join('')}${f.sql} ORDER BY j.id DESC LIMIT ?`).all(...args, ...f.args, req.query.limite);
    });

    app.get('/api/jobs/resumo', {
      preHandler: ver,
      schema: { querystring: { type: 'object', properties: { ...ESCOPO_QUERY } } },
    }, async (req) => {
      const f = filtroEscopo(req.query);
      const desde = Date.now() - 86400_000;
      const linhas = db.prepare(`SELECT j.status, COUNT(*) AS n FROM jobs j JOIN agentes a ON a.id = j.agente_id
        WHERE j.criado_em >= ?${f.sql} GROUP BY j.status`).all(desde, ...f.args);
      return { ultimas24h: Object.fromEntries(linhas.map((l) => [l.status, l.n])) };
    });

    app.get('/api/jobs/:id', { preHandler: ver, schema: { params: PARAMS_ID } }, async (req, reply) => {
      const j = db.prepare(`SELECT j.id, j.agente_id, j.script_id, j.nome, j.shell, j.conteudo, j.timeout, j.status, j.criado_por,
          j.criado_em, j.enviado_em, j.concluido_em, j.codigo_saida, j.stdout, j.stderr, j.duracao_ms, j.lote, j.origem, j.tipo,
          j.monitor_status, j.monitor_msg, a.hostname
        FROM jobs j JOIN agentes a ON a.id = j.agente_id WHERE j.id = ?`).get(req.params.id);
      return j ?? reply.code(404).send({ erro: 'Job não encontrado' });
    });

    app.get('/api/agentes/:id/jobs', { preHandler: ver, schema: { params: PARAMS_AGENTE } }, async (req) =>
      db.prepare(`SELECT ${COLS} FROM jobs j JOIN agentes a ON a.id = j.agente_id WHERE j.agente_id = ? ORDER BY j.id DESC LIMIT 100`).all(req.params.id));

    app.post('/api/jobs/:id/cancelar', { preHandler: ctx.exigir('scripts.executar'), schema: { params: PARAMS_ID } }, async (req, reply) => {
      const j = db.prepare("SELECT id, agente_id, nome FROM jobs WHERE id = ? AND status = 'pendente'").get(req.params.id);
      if (!j) return reply.code(409).send({ erro: 'Só é possível cancelar execuções que ainda estão na fila' });
      db.prepare("UPDATE jobs SET status = 'cancelado', concluido_em = ?, env_json = NULL WHERE id = ?").run(Date.now(), j.id);
      ctx.auditarReq(req, 'job_cancelado', { alvo: `${j.nome} #${j.id}`, agente_id: j.agente_id });
      ctx.emitir('job', { id: j.id, agente_id: j.agente_id, status: 'cancelado' });
      return { ok: true };
    });
  },
};
