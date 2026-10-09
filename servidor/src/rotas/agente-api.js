// API usada pelo agente: registro com token de instalação, check-in e envio de resultados.
import { randomUUID } from 'node:crypto';
import { gerarToken, sha256, iguaisSeguro } from '../seguranca.js';
import { auditar, truncar, MAX_SAIDA } from '../nucleo.js';
import { avaliarMetricas, resolverAlerta } from '../alertas.js';
import { transacao } from '../db.js';

const INTERVALO_AMOSTRA = 60_000; // no máx. 1 ponto de histórico por minuto por agente
const INVENTARIO_VALIDADE = 3600_000;

const txt = (max) => ({ type: 'string', maxLength: max });
const num = { type: 'number' };
const numOuNulo = { type: ['number', 'null'] };

const infoSchema = {
  type: 'object', additionalProperties: false,
  required: ['hostname'],
  properties: {
    hostname: { type: 'string', minLength: 1, maxLength: 255 },
    so: txt(64), so_versao: txt(255), arquitetura: txt(64), versao_agente: txt(32),
  },
};

const metricasSchema = {
  type: 'object', additionalProperties: false,
  properties: {
    cpu: { type: 'number', minimum: 0, maximum: 100 },
    ram_usada: num, ram_total: num,
    uptime: num,
    usuario: { type: ['string', 'null'], maxLength: 255 },
    ip: { type: ['string', 'null'], maxLength: 64 },
    discos: {
      type: 'array', maxItems: 64,
      items: { type: 'object', additionalProperties: false, properties: {
        ponto: txt(255), fs: txt(64), total: num, usado: num, pct: { type: 'number', minimum: 0, maximum: 100 },
      } },
    },
  },
};

const inventarioSchema = {
  type: 'object',
  properties: {
    sistema: { type: 'object' },
    hardware: { type: 'object' },
    rede: { type: 'array', maxItems: 128 },
    discos: { type: 'array', maxItems: 64 },
    softwares: { type: 'array', maxItems: 5000 },
  },
};

export default async function rotasAgenteApi(app, ctx) {
  const { db, hub, config } = ctx;
  const amostras = new Map();

  /** preHandler: autentica o agente pelo header "Authorization: Bearer <id>:<segredo>". */
  async function autenticarAgente(req, reply) {
    const m = /^Bearer ([0-9a-f-]{36}):([A-Za-z0-9_-]{20,128})$/.exec(req.headers.authorization || '');
    const agente = m ? db.prepare('SELECT * FROM agentes WHERE id = ?').get(m[1]) : null;
    if (!agente || agente.revogado || !iguaisSeguro(sha256(m[2]), agente.segredo_hash)) {
      return reply.code(401).send({ erro: 'Agente não autorizado' });
    }
    req.agente = agente;
  }

  app.post('/api/agente/registrar', {
    config: { rateLimit: { max: config.limites.registrar, timeWindow: '1 minute' } },
    schema: { body: { type: 'object', required: ['token', 'info'], additionalProperties: false,
      properties: { token: { type: 'string', minLength: 20, maxLength: 128 }, info: infoSchema } } },
  }, async (req, reply) => {
    const agora = Date.now();
    const hash = sha256(req.body.token);
    const resultado = transacao(db, () => {
      const t = db.prepare('SELECT * FROM tokens_instalacao WHERE token_hash = ?').get(hash);
      if (!t) return { erro: 'Token de instalação inválido' };
      if (t.usado_em) return { erro: 'Token de instalação já foi usado' };
      if (t.expira_em <= agora) return { erro: 'Token de instalação expirado' };
      const id = randomUUID();
      const segredo = gerarToken();
      const i = req.body.info;
      db.prepare(`INSERT INTO agentes (id, segredo_hash, hostname, so, so_versao, arquitetura, versao_agente, registrado_em, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pendente')`)
        .run(id, sha256(segredo), i.hostname, i.so ?? null, i.so_versao ?? null, i.arquitetura ?? null, i.versao_agente ?? null, agora);
      db.prepare('UPDATE tokens_instalacao SET usado_em = ?, agente_id = ? WHERE id = ?').run(agora, id, t.id);
      return { id, segredo, criadoPor: t.criado_por, hostname: i.hostname };
    });
    if (resultado.erro) {
      auditar(db, { acao: 'agente_registro_negado', detalhes: resultado.erro, ip: req.ip });
      return reply.code(401).send({ erro: resultado.erro });
    }
    auditar(db, { usuario: resultado.criadoPor, acao: 'agente_registrado', alvo: `${resultado.hostname} (${resultado.id})`, ip: req.ip });
    hub.emitir('agente', { id: resultado.id, hostname: resultado.hostname, status: 'pendente', novo: true });
    return { id: resultado.id, segredo: resultado.segredo, intervalo: config.intervaloCheckin };
  });

  app.post('/api/agente/checkin', {
    preHandler: autenticarAgente,
    config: { rateLimit: { max: 600, timeWindow: '1 minute' } },
    schema: { body: { type: 'object', required: ['metricas'], additionalProperties: false,
      properties: { metricas: metricasSchema, inventario: inventarioSchema, info: infoSchema } } },
  }, async (req) => {
    const a = req.agente;
    const m = req.body.metricas;
    const agora = Date.now();
    const discos = m.discos ?? [];
    const pior = discos.reduce((acc, d) => (d.pct != null && d.pct > (acc?.pct ?? -1) ? d : acc), null);
    const ramPct = m.ram_total ? (m.ram_usada / m.ram_total) * 100 : null;
    const info = req.body.info;

    db.prepare(`UPDATE agentes SET cpu_pct = ?, ram_usada = ?, ram_total = ?, disco_max_pct = ?, discos_json = ?,
        uptime = ?, usuario_logado = ?, ip_local = ?, ultimo_checkin = ?, status = 'online',
        hostname = COALESCE(?, hostname), so = COALESCE(?, so), so_versao = COALESCE(?, so_versao),
        arquitetura = COALESCE(?, arquitetura), versao_agente = COALESCE(?, versao_agente)
      WHERE id = ?`)
      .run(m.cpu ?? null, m.ram_usada ?? null, m.ram_total ?? null, pior?.pct ?? null, JSON.stringify(discos),
        m.uptime ?? null, m.usuario ?? null, m.ip ?? null, agora,
        info?.hostname ?? null, info?.so ?? null, info?.so_versao ?? null, info?.arquitetura ?? null, info?.versao_agente ?? null,
        a.id);

    if (req.body.inventario) {
      db.prepare('UPDATE agentes SET inventario_json = ?, inventario_em = ? WHERE id = ?')
        .run(JSON.stringify(req.body.inventario), agora, a.id);
    }

    if (agora - (amostras.get(a.id) ?? 0) >= INTERVALO_AMOSTRA) {
      amostras.set(a.id, agora);
      db.prepare('INSERT INTO metricas (agente_id, ts, cpu, ram_pct, disco_pct) VALUES (?, ?, ?, ?, ?)')
        .run(a.id, agora, m.cpu ?? null, ramPct, pior?.pct ?? null);
    }

    if (a.status !== 'online') {
      resolverAlerta(ctx, a, 'offline');
      hub.emitir('agente', { id: a.id, hostname: a.hostname, status: 'online' });
    }
    avaliarMetricas(ctx, a, { cpu: m.cpu, ramPct, discoMax: pior?.pct, discoPonto: pior?.ponto });

    // Entrega jobs pendentes (marcando como enviados).
    const jobs = transacao(db, () => {
      const pend = db.prepare(`SELECT id, shell, conteudo, timeout FROM jobs
        WHERE agente_id = ? AND status = 'pendente' ORDER BY id LIMIT 10`).all(a.id);
      const marcar = db.prepare("UPDATE jobs SET status = 'enviado', enviado_em = ? WHERE id = ?");
      for (const j of pend) marcar.run(agora, j.id);
      return pend;
    });
    for (const j of jobs) hub.emitir('job', { id: j.id, agente_id: a.id, status: 'enviado' });

    hub.emitir('checkin', {
      id: a.id, hostname: info?.hostname ?? a.hostname, status: 'online', cpu_pct: m.cpu ?? null,
      ram_usada: m.ram_usada ?? null, ram_total: m.ram_total ?? null, disco_max_pct: pior?.pct ?? null,
      uptime: m.uptime ?? null, ip_local: m.ip ?? null, usuario_logado: m.usuario ?? null, ultimo_checkin: agora,
    });

    const invEm = req.body.inventario ? agora : a.inventario_em;
    return {
      intervalo: config.intervaloCheckin,
      pedirInventario: !invEm || agora - invEm > INVENTARIO_VALIDADE + 300_000,
      jobs,
    };
  });

  app.post('/api/agente/resultado', {
    preHandler: autenticarAgente,
    config: { rateLimit: { max: 600, timeWindow: '1 minute' } },
    schema: { body: { type: 'object', required: ['job_id'], additionalProperties: false, properties: {
      job_id: { type: 'integer', minimum: 1 },
      codigo_saida: { type: ['integer', 'null'] },
      stdout: txt(MAX_SAIDA + 1024), stderr: txt(MAX_SAIDA + 1024),
      duracao_ms: numOuNulo,
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
    const agora = Date.now();
    db.prepare(`UPDATE jobs SET status = ?, codigo_saida = ?, stdout = ?, stderr = ?, duracao_ms = ?, concluido_em = ?
      WHERE id = ?`).run(status, b.codigo_saida ?? null, truncar(b.stdout), truncar(stderr), b.duracao_ms ?? null, agora, job.id);
    hub.emitir('job', { id: job.id, agente_id: req.agente.id, hostname: req.agente.hostname, nome: job.nome, status, codigo_saida: b.codigo_saida ?? null, concluido_em: agora });
    return { ok: true };
  });
}
