// Alertas: regras globais (CPU, RAM, disco, offline) avaliadas a cada check-in e periodicamente, com severidade,
// webhook, exceções por agente (override de limite/ciclos/minutos ou "desligado"), janelas de manutenção
// (suprime webhook + contagem "aberto", mas fica registrado/auditável) e uma API para outros módulos
// abrirem/resolverem alertas próprios: ctx.servicos.alertas.abrir(...).
import { lerConfig, definirConfig, marcadores } from '../../db.js';
import { PARAMS_ID, ID_AGENTE, ALVO_SCHEMA, filtroEscopo, ESCOPO_QUERY } from '../../nucleo/util.js';

export const REGRAS_PADRAO = {
  cpu: { ativo: true, limite: 90, ciclos: 4 },
  ram: { ativo: true, limite: 90, ciclos: 4 },
  disco: { ativo: true, limite: 90 },
  offline: { ativo: true, minutos: 5 },
};
export const SEVERIDADES = ['info', 'alerta', 'critico'];
export const TIPOS_OVERRIDE = ['cpu', 'ram', 'disco', 'offline'];
const NOMES = { cpu: 'CPU', ram: 'Memória', disco: 'Disco', offline: 'Offline' };

export function regrasAtuais(db) {
  const salvas = lerConfig(db, 'regras', {});
  const r = {};
  for (const k of Object.keys(REGRAS_PADRAO)) r[k] = { ...REGRAS_PADRAO[k], ...(salvas[k] || {}) };
  return r;
}

/** Overrides de um agente para um tipo (objeto parcial {ativo?, limite?, ciclos?, minutos?}), ou null. */
function overrideDoAgente(db, agenteId, tipo) {
  const row = db.prepare('SELECT ajustes_json FROM alertas_overrides WHERE agente_id = ? AND tipo = ?').get(agenteId, tipo);
  return row ? JSON.parse(row.ajustes_json) : null;
}

/** Todos os overrides de um agente, um por tipo, com metadados (para a aba "Alertas" do dispositivo). */
export function overridesDoAgente(db, agenteId) {
  return db.prepare('SELECT tipo, ajustes_json, criado_por, atualizado_em FROM alertas_overrides WHERE agente_id = ? ORDER BY tipo')
    .all(agenteId).map((r) => ({ tipo: r.tipo, criado_por: r.criado_por, atualizado_em: r.atualizado_em, ...JSON.parse(r.ajustes_json) }));
}

/** Mapa agente_id → ajustes, para laços que avaliam muitos agentes de uma vez (ex.: a tarefa de offline). */
export function overridesPorTipo(db, tipo) {
  const m = new Map();
  for (const r of db.prepare('SELECT agente_id, ajustes_json FROM alertas_overrides WHERE tipo = ?').all(tipo)) m.set(r.agente_id, JSON.parse(r.ajustes_json));
  return m;
}

/** Regra efetiva (global mesclada com o override do agente, se houver) para um tipo. */
export function regraParaAgente(db, agenteId, tipo) {
  const base = regrasAtuais(db)[tipo];
  const ajustes = overrideDoAgente(db, agenteId, tipo);
  return ajustes ? { ...base, ...ajustes } : base;
}

/** Janelas de manutenção ativas agora (início já passou, fim ainda não chegou, não cancelada). */
export function manutencoesAtivas(db, agora = Date.now()) {
  return db.prepare('SELECT * FROM alertas_manutencao WHERE cancelado_em IS NULL AND inicio <= ? AND fim > ?').all(agora, agora);
}

/** Se o agente está, agora, dentro de alguma janela de manutenção. */
export function agenteEmManutencao(db, agenteId, agora = Date.now()) {
  return manutencoesAtivas(db, agora).some((m) => {
    try { return JSON.parse(m.agentes_json).includes(agenteId); } catch { return false; }
  });
}

export function webhookAtual(ctx) {
  return lerConfig(ctx.db, 'webhook_url', null) ?? ctx.config.webhookUrl ?? '';
}

export async function enviarWebhook(ctx, alerta, url = webhookAtual(ctx)) {
  if (!url) return false;
  const texto = `[Farol RMM] ${NOMES[alerta.tipo] ?? alerta.tipo} — ${alerta.hostname ?? alerta.agente_id}: ${alerta.mensagem}`;
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      // "content" é lido pelo Discord, "text" pelo Slack; o objeto completo segue em "alerta".
      body: JSON.stringify({ content: texto, text: texto, alerta }),
      signal: AbortSignal.timeout(5000),
      redirect: 'error',
    });
    return r.ok;
  } catch (e) {
    ctx.log?.warn?.({ err: e.message }, 'falha ao enviar webhook');
    return false;
  }
}

function criarServico(ctx) {
  const { db } = ctx;
  const servico = {
    /**
     * Abre (ou atualiza, se já aberto) um alerta do tipo para o agente. Devolve o alerta novo ou null se só atualizou.
     * @param {{id: string, hostname?: string}} agente
     * @param {{tipo: string, mensagem: string, valor?: number, severidade?: 'info'|'alerta'|'critico'}} dados
     */
    abrir(agente, { tipo, mensagem, valor = null, severidade = 'alerta' }) {
      if (!SEVERIDADES.includes(severidade)) throw new Error(`Severidade inválida: ${severidade}`);
      // Durante uma janela de manutenção o alerta continua sendo registrado (auditável), mas não dispara
      // webhook nem conta como "aberto" no painel. Recalculado a cada chamada: se a janela terminar com o
      // alerta ainda aberto, a próxima avaliação já o tira da condição de suprimido.
      const suprimir = agenteEmManutencao(db, agente.id);
      const aberto = db.prepare("SELECT id, severidade FROM alertas WHERE agente_id = ? AND tipo = ? AND status = 'aberto'").get(agente.id, tipo);
      if (aberto) {
        db.prepare('UPDATE alertas SET valor = ?, mensagem = ?, severidade = ?, suprimido = ? WHERE id = ?').run(valor, mensagem, severidade, suprimir ? 1 : 0, aberto.id);
        if (aberto.severidade !== severidade) ctx.emitir('alerta', { id: aberto.id, agente_id: agente.id, tipo, severidade, status: 'aberto', atualizado: true, suprimido: suprimir });
        return null;
      }
      const agora = Date.now();
      const { lastInsertRowid } = db.prepare(`INSERT INTO alertas (agente_id, tipo, mensagem, valor, status, aberto_em, severidade, suprimido)
        VALUES (?, ?, ?, ?, 'aberto', ?, ?, ?)`).run(agente.id, tipo, mensagem, valor, agora, severidade, suprimir ? 1 : 0);
      const hostname = agente.hostname ?? db.prepare('SELECT hostname FROM agentes WHERE id = ?').get(agente.id)?.hostname;
      const alerta = { id: Number(lastInsertRowid), agente_id: agente.id, hostname, tipo, mensagem, valor, severidade, status: 'aberto', aberto_em: agora, suprimido: suprimir };
      ctx.emitir('alerta', alerta);
      if (!suprimir) enviarWebhook(ctx, alerta);
      return alerta;
    },

    /** Resolve os alertas abertos do tipo para o agente. Devolve quantos resolveu. */
    resolver(agente, tipo, { por = null } = {}) {
      const agora = Date.now();
      const abertos = db.prepare("SELECT id FROM alertas WHERE agente_id = ? AND tipo = ? AND status = 'aberto'").all(agente.id, tipo);
      for (const { id } of abertos) {
        db.prepare("UPDATE alertas SET status = 'resolvido', resolvido_em = ?, resolvido_por = ? WHERE id = ?").run(agora, por, id);
        ctx.emitir('alerta', { id, agente_id: agente.id, hostname: agente.hostname, tipo, status: 'resolvido', resolvido_em: agora });
      }
      return abertos.length;
    },

    regras: () => regrasAtuais(db),

    /**
     * Define (ou remove, se `ajustes` for {}) a exceção de um tipo de alerta para um agente — mesma lógica
     * de PUT /api/alertas/overrides, exposta aqui como serviço reaproveitável por qualquer módulo que
     * precise ajustar vários agentes de uma vez, sem duplicar esta regra de merge/gravação.
     * @param {{ativo?, limite?, ciclos?, minutos?}} ajustes
     */
    definirOverride(agenteId, tipo, ajustes, { usuario = 'sistema' } = {}) {
      if (!Object.keys(ajustes).length) {
        db.prepare('DELETE FROM alertas_overrides WHERE agente_id = ? AND tipo = ?').run(agenteId, tipo);
        return { tipo, removido: true };
      }
      db.prepare(`INSERT INTO alertas_overrides (agente_id, tipo, ajustes_json, criado_por, atualizado_em) VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(agente_id, tipo) DO UPDATE SET ajustes_json = excluded.ajustes_json, atualizado_em = excluded.atualizado_em`)
        .run(agenteId, tipo, JSON.stringify(ajustes), usuario, Date.now());
      return { tipo, ...ajustes };
    },
  };
  return servico;
}

/** Avalia CPU/RAM/disco de um check-in. `agente` é a linha antes da atualização. Respeita o override do agente, se houver. */
export function avaliarMetricas(ctx, agente, { cpu, ramPct, discoMax, discoPonto }) {
  const al = ctx.servicos.alertas;
  const seqs = {};
  for (const [tipo, valor, coluna] of [['cpu', cpu, 'cpu_seq'], ['ram', ramPct, 'ram_seq']]) {
    const regra = regraParaAgente(ctx.db, agente.id, tipo);
    if (regra.ativo && valor != null && valor > regra.limite) {
      seqs[coluna] = (agente[coluna] || 0) + 1;
      if (seqs[coluna] >= regra.ciclos) {
        al.abrir(agente, { tipo, severidade: valor >= 98 ? 'critico' : 'alerta', valor,
          mensagem: `${NOMES[tipo]} em ${valor.toFixed(0)}% (limite ${regra.limite}%) por ${seqs[coluna]} check-ins seguidos` });
      }
    } else {
      seqs[coluna] = 0;
      al.resolver(agente, tipo);
    }
  }
  ctx.db.prepare('UPDATE agentes SET cpu_seq = ?, ram_seq = ? WHERE id = ?').run(seqs.cpu_seq, seqs.ram_seq, agente.id);

  const rd = regraParaAgente(ctx.db, agente.id, 'disco');
  if (rd.ativo && discoMax != null && discoMax > rd.limite) {
    al.abrir(agente, { tipo: 'disco', severidade: discoMax >= 95 ? 'critico' : 'alerta', valor: discoMax,
      mensagem: `Disco ${discoPonto ?? ''} em ${discoMax.toFixed(0)}% (limite ${rd.limite}%)`.replace('  ', ' ') });
  } else {
    al.resolver(agente, 'disco');
  }
}

export default {
  nome: 'alertas',
  descricao: 'Regras de alerta, severidade e webhook',
  depende: ['agentes'],
  permissoes: {
    'alertas.ver': { descricao: 'Ver alertas', papeis: ['tecnico', 'leitura'] },
    'alertas.resolver': { descricao: 'Marcar alertas como resolvidos', papeis: ['tecnico'] },
    'alertas.configurar': { descricao: 'Alterar regras de alerta e webhook' },
  },
  migracoes: [
    // 1 — tabela da v1
    `CREATE TABLE IF NOT EXISTS alertas (
      id INTEGER PRIMARY KEY,
      agente_id TEXT NOT NULL REFERENCES agentes(id) ON DELETE CASCADE,
      tipo TEXT NOT NULL,
      mensagem TEXT NOT NULL,
      valor REAL,
      status TEXT NOT NULL DEFAULT 'aberto',
      aberto_em INTEGER NOT NULL,
      resolvido_em INTEGER
    );
    CREATE INDEX IF NOT EXISTS ix_alertas ON alertas(agente_id, tipo, status);`,
    // 2 — severidade e quem resolveu
    `ALTER TABLE alertas ADD COLUMN severidade TEXT NOT NULL DEFAULT 'alerta';
    ALTER TABLE alertas ADD COLUMN resolvido_por TEXT;
    UPDATE alertas SET severidade = 'critico' WHERE tipo = 'offline';
    CREATE INDEX ix_alertas_status ON alertas(status, id);`,
    // 3 — janelas de manutenção (suprimem webhook/contagem, sem esconder o alerta) e exceções por agente
    `ALTER TABLE alertas ADD COLUMN suprimido INTEGER NOT NULL DEFAULT 0;
    CREATE INDEX ix_alertas_suprimido ON alertas(status, suprimido);
    CREATE TABLE alertas_manutencao (
      id INTEGER PRIMARY KEY,
      alvo_tipo TEXT NOT NULL,
      alvo_label TEXT NOT NULL,
      agentes_json TEXT NOT NULL,
      inicio INTEGER NOT NULL,
      fim INTEGER NOT NULL,
      motivo TEXT,
      criado_por TEXT NOT NULL,
      criado_em INTEGER NOT NULL,
      cancelado_em INTEGER,
      cancelado_por TEXT
    );
    CREATE INDEX ix_alertas_manutencao_janela ON alertas_manutencao(fim, cancelado_em);
    CREATE TABLE alertas_overrides (
      agente_id TEXT NOT NULL REFERENCES agentes(id) ON DELETE CASCADE,
      tipo TEXT NOT NULL,
      ajustes_json TEXT NOT NULL,
      criado_por TEXT,
      atualizado_em INTEGER NOT NULL,
      PRIMARY KEY (agente_id, tipo)
    );`,
  ],

  servico: criarServico,

  aoCheckin(agente, _payload, ctx, resumo) {
    ctx.servicos.alertas.resolver(agente, 'offline');
    avaliarMetricas(ctx, agente, resumo);
  },

  aoIniciar(ctx) {
    // Lista de dispositivos ganha a contagem de alertas abertos (não contando os suprimidos por manutenção),
    // a severidade máxima e se o dispositivo está, agora, dentro de uma janela de manutenção.
    ctx.servicos.agentes.registrarEnriquecedor('alertas', (linhas, c) => {
      if (!linhas.length) return;
      const porId = new Map();
      const ids = linhas.map((l) => l.id);
      for (let i = 0; i < ids.length; i += 500) {
        const parte = ids.slice(i, i + 500);
        for (const r of c.db.prepare(`SELECT agente_id, COUNT(*) AS n,
            MAX(CASE severidade WHEN 'critico' THEN 3 WHEN 'alerta' THEN 2 ELSE 1 END) AS sev
          FROM alertas WHERE status = 'aberto' AND suprimido = 0 AND agente_id IN (${marcadores(parte.length)}) GROUP BY agente_id`).all(...parte)) porId.set(r.agente_id, r);
      }
      const cobertos = new Set();
      for (const m of manutencoesAtivas(c.db)) {
        try { for (const id of JSON.parse(m.agentes_json)) cobertos.add(id); } catch { /* janela corrompida: ignora */ }
      }
      for (const l of linhas) {
        const r = porId.get(l.id);
        l.alertas_abertos = r?.n ?? 0;
        l.alerta_severidade = r ? [null, 'info', 'alerta', 'critico'][r.sev] : null;
        l.em_manutencao = cobertos.has(l.id);
      }
    });

    ctx.agendador.registrar('alertas.offline', 10_000, ({ db }, agora) => {
      const regraGlobal = regrasAtuais(db).offline;
      const overrides = overridesPorTipo(db, 'offline');
      // Agente com o tipo "offline" desligado por override: resolve um alerta que porventura já esteja aberto.
      for (const [agenteId, ajustes] of overrides) {
        if (ajustes.ativo === false) ctx.servicos.alertas.resolver({ id: agenteId }, 'offline');
      }
      if (!regraGlobal.ativo && !overrides.size) return;
      const antigos = db.prepare('SELECT id, hostname, ultimo_checkin FROM agentes WHERE revogado = 0 AND status = \'offline\'').all();
      for (const a of antigos) {
        const regra = { ...regraGlobal, ...(overrides.get(a.id) || {}) };
        if (!regra.ativo || a.ultimo_checkin >= agora - regra.minutos * 60_000) continue;
        const min = Math.floor((agora - a.ultimo_checkin) / 60_000);
        const tempo = min < 60 ? `${min} min` : min < 1440 ? `${Math.floor(min / 60)} h ${min % 60} min` : `${Math.floor(min / 1440)} d ${Math.floor((min % 1440) / 60)} h`;
        ctx.servicos.alertas.abrir(a, { tipo: 'offline', severidade: 'critico', valor: min, mensagem: `Sem check-in há ${tempo} (limite ${regra.minutos} min)` });
      }
    });

    // Janelas de manutenção vencidas passam a valer como expiradas automaticamente (comparação por horário,
    // nenhuma limpeza é necessária) — mas uma faxina periódica evita acumular milhares de janelas antigas.
    ctx.agendador.registrar('alertas.manutencao_limpeza', 3600_000, ({ db }, agora) => {
      db.prepare('DELETE FROM alertas_manutencao WHERE fim < ?').run(agora - 90 * 86400_000);
    });
  },

  rotas(app, ctx) {
    const { db } = ctx;

    app.get('/api/alertas', {
      preHandler: ctx.exigir('alertas.ver'),
      schema: { querystring: { type: 'object', properties: {
        status: { type: 'string', enum: ['aberto', 'resolvido', 'todos'], default: 'todos' },
        severidade: { type: 'string', enum: SEVERIDADES },
        agente: ID_AGENTE,
        limite: { type: 'integer', minimum: 1, maximum: 1000, default: 300 },
        ...ESCOPO_QUERY,
      } } },
    }, async (req) => {
      const q = req.query;
      const f = filtroEscopo(q);
      const onde = [];
      const args = [];
      if (q.status !== 'todos') { onde.push('al.status = ?'); args.push(q.status); }
      if (q.severidade) { onde.push('al.severidade = ?'); args.push(q.severidade); }
      if (q.agente) { onde.push('al.agente_id = ?'); args.push(q.agente); }
      const where = `WHERE a.revogado = 0${onde.length ? ` AND ${onde.join(' AND ')}` : ''}${f.sql}`;
      return db.prepare(`SELECT al.*, a.hostname, a.site_id, s.nome AS site_nome
        FROM alertas al JOIN agentes a ON a.id = al.agente_id JOIN sites s ON s.id = a.site_id ${where}
        ORDER BY (al.status = 'aberto') DESC, CASE al.severidade WHEN 'critico' THEN 0 WHEN 'alerta' THEN 1 ELSE 2 END, al.id DESC
        LIMIT ?`).all(...args, ...f.args, q.limite);
    });

    app.get('/api/alertas/resumo', {
      preHandler: ctx.exigir('alertas.ver'),
      schema: { querystring: { type: 'object', properties: { ...ESCOPO_QUERY } } },
    }, async (req) => {
      const f = filtroEscopo(req.query);
      // Suprimido (agente em manutenção) continua registrado, mas não entra nestes totais do painel.
      const linhas = db.prepare(`SELECT al.severidade, COUNT(*) AS n FROM alertas al JOIN agentes a ON a.id = al.agente_id
        WHERE al.status = 'aberto' AND al.suprimido = 0 AND a.revogado = 0${f.sql} GROUP BY al.severidade`).all(...f.args);
      const porSeveridade = Object.fromEntries(SEVERIDADES.map((s) => [s, 0]));
      for (const l of linhas) porSeveridade[l.severidade] = l.n;
      const porTipo = db.prepare(`SELECT al.tipo, COUNT(*) AS n FROM alertas al JOIN agentes a ON a.id = al.agente_id
        WHERE al.status = 'aberto' AND al.suprimido = 0 AND a.revogado = 0${f.sql} GROUP BY al.tipo ORDER BY n DESC`).all(...f.args);
      const dia = Date.now() - 86400_000;
      const ultimas24h = db.prepare(`SELECT COUNT(*) AS n FROM alertas al JOIN agentes a ON a.id = al.agente_id
        WHERE al.aberto_em >= ? AND a.revogado = 0${f.sql}`).get(dia, ...f.args).n;
      const suprimidos = db.prepare(`SELECT COUNT(*) AS n FROM alertas al JOIN agentes a ON a.id = al.agente_id
        WHERE al.status = 'aberto' AND al.suprimido = 1 AND a.revogado = 0${f.sql}`).get(...f.args).n;
      return { abertos: linhas.reduce((n, l) => n + l.n, 0), porSeveridade, porTipo, ultimas24h, suprimidos };
    });

    app.post('/api/alertas/:id/resolver', { preHandler: ctx.exigir('alertas.resolver'), schema: { params: PARAMS_ID } }, async (req, reply) => {
      const al = db.prepare("SELECT al.id, al.agente_id, al.tipo, a.hostname FROM alertas al JOIN agentes a ON a.id = al.agente_id WHERE al.id = ? AND al.status = 'aberto'").get(req.params.id);
      if (!al) return reply.code(404).send({ erro: 'Alerta não encontrado ou já resolvido' });
      db.prepare("UPDATE alertas SET status = 'resolvido', resolvido_em = ?, resolvido_por = ? WHERE id = ?").run(Date.now(), req.sessao.usuario, al.id);
      ctx.auditarReq(req, 'alerta_resolvido', { alvo: `alerta #${al.id} (${al.hostname})`, agente_id: al.agente_id });
      ctx.emitir('alerta', { id: al.id, agente_id: al.agente_id, tipo: al.tipo, status: 'resolvido' });
      return { ok: true };
    });

    // ---------- Regras e webhook ----------
    const regraLimite = (comCiclos) => ({
      type: 'object', additionalProperties: false, required: ['ativo', 'limite'],
      properties: {
        ativo: { type: 'boolean' },
        limite: { type: 'number', minimum: 1, maximum: 100 },
        ...(comCiclos ? { ciclos: { type: 'integer', minimum: 1, maximum: 100 } } : {}),
      },
    });

    app.get('/api/config', { preHandler: ctx.exigir('alertas.ver') }, async () => ({ regras: regrasAtuais(db), webhook_url: webhookAtual(ctx) }));

    app.put('/api/config', {
      preHandler: ctx.exigir('alertas.configurar'),
      schema: { body: {
        type: 'object', additionalProperties: false, required: ['regras'],
        properties: {
          regras: {
            type: 'object', additionalProperties: false, required: ['cpu', 'ram', 'disco', 'offline'],
            properties: {
              cpu: regraLimite(true), ram: regraLimite(true), disco: regraLimite(false),
              offline: { type: 'object', additionalProperties: false, required: ['ativo', 'minutos'],
                properties: { ativo: { type: 'boolean' }, minutos: { type: 'integer', minimum: 1, maximum: 10_080 } } },
            },
          },
          webhook_url: { type: 'string', maxLength: 500, pattern: '^(https?://\\S+)?$' },
        },
      } },
    }, async (req) => {
      const antes = { regras: regrasAtuais(db), webhook_url: webhookAtual(ctx) };
      definirConfig(db, 'regras', req.body.regras);
      if (req.body.webhook_url !== undefined) definirConfig(db, 'webhook_url', req.body.webhook_url);
      ctx.auditarReq(req, 'regras_alteradas', { alvo: 'alertas', detalhes: { antes, depois: req.body } });
      return { regras: regrasAtuais(db), webhook_url: webhookAtual(ctx) };
    });

    app.post('/api/config/webhook-teste', { preHandler: ctx.exigir('alertas.configurar') }, async (req, reply) => {
      const url = webhookAtual(ctx);
      if (!url) return reply.code(400).send({ erro: 'Nenhum webhook configurado' });
      const ok = await enviarWebhook(ctx, { tipo: 'teste', hostname: 'Farol', mensagem: 'Webhook de teste — está funcionando.' }, url);
      ctx.auditarReq(req, 'webhook_testado', { detalhes: ok ? 'ok' : 'falhou' });
      return ok ? { ok } : reply.code(502).send({ erro: 'O webhook não respondeu com sucesso' });
    });

    // ---------- Janelas de manutenção ----------
    function manutencaoParaFora(m, agora = Date.now()) {
      return {
        id: m.id, alvo_tipo: m.alvo_tipo, alvo_label: m.alvo_label, agentes: JSON.parse(m.agentes_json),
        inicio: m.inicio, fim: m.fim, motivo: m.motivo, criado_por: m.criado_por, criado_em: m.criado_em,
        cancelado_em: m.cancelado_em, cancelado_por: m.cancelado_por,
        estado: m.cancelado_em ? 'cancelada' : agora >= m.fim ? 'expirada' : agora >= m.inicio ? 'ativa' : 'agendada',
      };
    }

    app.get('/api/alertas/manutencao', {
      preHandler: ctx.exigir('alertas.ver'),
      schema: { querystring: { type: 'object', properties: {
        estado: { type: 'string', enum: ['ativa', 'agendada', 'expirada', 'cancelada'] },
        agente: ID_AGENTE,
      } } },
    }, async (req) => {
      const agora = Date.now();
      let linhas = db.prepare('SELECT * FROM alertas_manutencao ORDER BY inicio DESC LIMIT 300').all().map((m) => manutencaoParaFora(m, agora));
      if (req.query.estado) linhas = linhas.filter((m) => m.estado === req.query.estado);
      if (req.query.agente) linhas = linhas.filter((m) => m.agentes.includes(req.query.agente));
      return linhas;
    });

    app.post('/api/alertas/manutencao', {
      preHandler: ctx.exigir('alertas.configurar'),
      schema: { body: {
        type: 'object', additionalProperties: false, required: ['alvo'],
        properties: {
          alvo: ALVO_SCHEMA,
          duracaoMin: { type: 'integer', minimum: 1, maximum: 129_600 }, // até 90 dias
          inicio: { type: 'integer', minimum: 0 },
          fim: { type: 'integer', minimum: 0 },
          motivo: { type: 'string', maxLength: 300 },
        },
      } },
    }, async (req, reply) => {
      const b = req.body;
      const agora = Date.now();
      const inicio = b.inicio ?? agora;
      let fim;
      if (b.fim != null) fim = b.fim;
      else if (b.duracaoMin != null) fim = inicio + b.duracaoMin * 60_000;
      else return reply.code(400).send({ erro: 'Informe duracaoMin (a partir de agora) ou início + fim' });
      if (fim <= inicio) return reply.code(400).send({ erro: 'O fim precisa ser depois do início' });
      if (fim - inicio > 90 * 86400_000) return reply.code(400).send({ erro: 'Janela maior que 90 dias' });
      const agentes = await ctx.alvos.resolver(b.alvo);
      if (!agentes.length) return reply.code(400).send({ erro: 'Nenhum dispositivo no alvo' });
      const label = agentes.length <= 4 ? agentes.map((a) => a.hostname).join(', ') : `${agentes.length} dispositivos`;
      const { lastInsertRowid } = db.prepare(`INSERT INTO alertas_manutencao (alvo_tipo, alvo_label, agentes_json, inicio, fim, motivo, criado_por, criado_em)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(b.alvo.tipo, label, JSON.stringify(agentes.map((a) => a.id)), inicio, fim, b.motivo ?? null, req.sessao.usuario, agora);
      const id = Number(lastInsertRowid);
      ctx.auditarReq(req, 'manutencao_criada', { alvo: label, detalhes: { id, inicio, fim, alvo: b.alvo, dispositivos: agentes.length } });
      ctx.emitir('alerta', { manutencao: true, id, acao: 'criada' });
      return manutencaoParaFora(db.prepare('SELECT * FROM alertas_manutencao WHERE id = ?').get(id), agora);
    });

    app.post('/api/alertas/manutencao/:id/cancelar', { preHandler: ctx.exigir('alertas.configurar'), schema: { params: PARAMS_ID } }, async (req, reply) => {
      const m = db.prepare('SELECT id, alvo_label FROM alertas_manutencao WHERE id = ? AND cancelado_em IS NULL').get(req.params.id);
      if (!m) return reply.code(404).send({ erro: 'Janela não encontrada ou já cancelada' });
      db.prepare('UPDATE alertas_manutencao SET cancelado_em = ?, cancelado_por = ? WHERE id = ?').run(Date.now(), req.sessao.usuario, m.id);
      ctx.auditarReq(req, 'manutencao_cancelada', { alvo: m.alvo_label, detalhes: { id: m.id } });
      ctx.emitir('alerta', { manutencao: true, id: m.id, acao: 'cancelada' });
      return { ok: true };
    });

    // ---------- Exceções por agente (override de limite/ciclos/minutos, ou tipo desligado) ----------
    app.get('/api/alertas/overrides', {
      preHandler: ctx.exigir('alertas.ver'),
      schema: { querystring: { type: 'object', additionalProperties: false, required: ['agente'], properties: { agente: ID_AGENTE } } },
    }, async (req) => overridesDoAgente(db, req.query.agente));

    app.put('/api/alertas/overrides', {
      preHandler: ctx.exigir('alertas.configurar'),
      schema: { body: {
        type: 'object', additionalProperties: false, required: ['agente_id', 'tipo'],
        properties: {
          agente_id: ID_AGENTE,
          tipo: { type: 'string', enum: TIPOS_OVERRIDE },
          ativo: { type: ['boolean', 'null'] },
          limite: { type: ['number', 'null'], minimum: 1, maximum: 100 },
          ciclos: { type: ['integer', 'null'], minimum: 1, maximum: 100 },
          minutos: { type: ['integer', 'null'], minimum: 1, maximum: 10_080 },
        },
      } },
    }, async (req, reply) => {
      const b = req.body;
      const agente = db.prepare('SELECT id, hostname FROM agentes WHERE id = ?').get(b.agente_id);
      if (!agente) return reply.code(404).send({ erro: 'Dispositivo não encontrado' });
      const ajustes = {};
      if (b.ativo !== undefined && b.ativo !== null) ajustes.ativo = b.ativo;
      if (b.limite != null) ajustes.limite = b.limite;
      if (b.ciclos != null) ajustes.ciclos = b.ciclos;
      if (b.minutos != null) ajustes.minutos = b.minutos;
      const r = ctx.servicos.alertas.definirOverride(b.agente_id, b.tipo, ajustes, { usuario: req.sessao.usuario });
      ctx.auditarReq(req, r.removido ? 'alerta_override_removido' : 'alerta_override_definido', { alvo: agente.hostname, agente_id: agente.id, detalhes: { tipo: b.tipo, ...(r.removido ? {} : { ajustes }) } });
      return r;
    });
  },
};
