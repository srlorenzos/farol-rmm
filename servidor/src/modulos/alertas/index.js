// Alertas: regras globais (CPU, RAM, disco, offline) avaliadas a cada check-in e periodicamente, com severidade,
// webhook e uma API para outros módulos abrirem/resolverem alertas próprios: ctx.servicos.alertas.abrir(...).
import { lerConfig, definirConfig, marcadores } from '../../db.js';
import { PARAMS_ID, ID_AGENTE, filtroEscopo, ESCOPO_QUERY } from '../../nucleo/util.js';

export const REGRAS_PADRAO = {
  cpu: { ativo: true, limite: 90, ciclos: 4 },
  ram: { ativo: true, limite: 90, ciclos: 4 },
  disco: { ativo: true, limite: 90 },
  offline: { ativo: true, minutos: 5 },
};
export const SEVERIDADES = ['info', 'alerta', 'critico'];
const NOMES = { cpu: 'CPU', ram: 'Memória', disco: 'Disco', offline: 'Offline' };

export function regrasAtuais(db) {
  const salvas = lerConfig(db, 'regras', {});
  const r = {};
  for (const k of Object.keys(REGRAS_PADRAO)) r[k] = { ...REGRAS_PADRAO[k], ...(salvas[k] || {}) };
  return r;
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
      const aberto = db.prepare("SELECT id, severidade FROM alertas WHERE agente_id = ? AND tipo = ? AND status = 'aberto'").get(agente.id, tipo);
      if (aberto) {
        db.prepare('UPDATE alertas SET valor = ?, mensagem = ?, severidade = ? WHERE id = ?').run(valor, mensagem, severidade, aberto.id);
        if (aberto.severidade !== severidade) ctx.emitir('alerta', { id: aberto.id, agente_id: agente.id, tipo, severidade, status: 'aberto', atualizado: true });
        return null;
      }
      const agora = Date.now();
      const { lastInsertRowid } = db.prepare(`INSERT INTO alertas (agente_id, tipo, mensagem, valor, status, aberto_em, severidade)
        VALUES (?, ?, ?, ?, 'aberto', ?, ?)`).run(agente.id, tipo, mensagem, valor, agora, severidade);
      const hostname = agente.hostname ?? db.prepare('SELECT hostname FROM agentes WHERE id = ?').get(agente.id)?.hostname;
      const alerta = { id: Number(lastInsertRowid), agente_id: agente.id, hostname, tipo, mensagem, valor, severidade, status: 'aberto', aberto_em: agora };
      ctx.emitir('alerta', alerta);
      enviarWebhook(ctx, alerta);
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
  };
  return servico;
}

/** Avalia CPU/RAM/disco de um check-in. `agente` é a linha antes da atualização. */
export function avaliarMetricas(ctx, agente, { cpu, ramPct, discoMax, discoPonto }) {
  const regras = regrasAtuais(ctx.db);
  const al = ctx.servicos.alertas;
  const seqs = {};
  for (const [tipo, valor, coluna] of [['cpu', cpu, 'cpu_seq'], ['ram', ramPct, 'ram_seq']]) {
    const regra = regras[tipo];
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

  const rd = regras.disco;
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
  ],

  servico: criarServico,

  aoCheckin(agente, _payload, ctx, resumo) {
    ctx.servicos.alertas.resolver(agente, 'offline');
    avaliarMetricas(ctx, agente, resumo);
  },

  aoIniciar(ctx) {
    // Lista de dispositivos ganha a contagem de alertas abertos e a severidade máxima.
    ctx.servicos.agentes.registrarEnriquecedor('alertas', (linhas, c) => {
      if (!linhas.length) return;
      const porId = new Map();
      const ids = linhas.map((l) => l.id);
      for (let i = 0; i < ids.length; i += 500) {
        const parte = ids.slice(i, i + 500);
        for (const r of c.db.prepare(`SELECT agente_id, COUNT(*) AS n,
            MAX(CASE severidade WHEN 'critico' THEN 3 WHEN 'alerta' THEN 2 ELSE 1 END) AS sev
          FROM alertas WHERE status = 'aberto' AND agente_id IN (${marcadores(parte.length)}) GROUP BY agente_id`).all(...parte)) porId.set(r.agente_id, r);
      }
      for (const l of linhas) {
        const r = porId.get(l.id);
        l.alertas_abertos = r?.n ?? 0;
        l.alerta_severidade = r ? [null, 'info', 'alerta', 'critico'][r.sev] : null;
      }
    });

    ctx.agendador.registrar('alertas.offline', 10_000, ({ db }, agora) => {
      const regra = regrasAtuais(db).offline;
      if (!regra.ativo) return;
      const antigos = db.prepare(`SELECT id, hostname, ultimo_checkin FROM agentes
        WHERE revogado = 0 AND status = 'offline' AND ultimo_checkin < ?`).all(agora - regra.minutos * 60_000);
      for (const a of antigos) {
        const min = Math.floor((agora - a.ultimo_checkin) / 60_000);
        const tempo = min < 60 ? `${min} min` : min < 1440 ? `${Math.floor(min / 60)} h ${min % 60} min` : `${Math.floor(min / 1440)} d ${Math.floor((min % 1440) / 60)} h`;
        ctx.servicos.alertas.abrir(a, { tipo: 'offline', severidade: 'critico', valor: min, mensagem: `Sem check-in há ${tempo} (limite ${regra.minutos} min)` });
      }
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
      const linhas = db.prepare(`SELECT al.severidade, COUNT(*) AS n FROM alertas al JOIN agentes a ON a.id = al.agente_id
        WHERE al.status = 'aberto' AND a.revogado = 0${f.sql} GROUP BY al.severidade`).all(...f.args);
      const porSeveridade = Object.fromEntries(SEVERIDADES.map((s) => [s, 0]));
      for (const l of linhas) porSeveridade[l.severidade] = l.n;
      const porTipo = db.prepare(`SELECT al.tipo, COUNT(*) AS n FROM alertas al JOIN agentes a ON a.id = al.agente_id
        WHERE al.status = 'aberto' AND a.revogado = 0${f.sql} GROUP BY al.tipo ORDER BY n DESC`).all(...f.args);
      const dia = Date.now() - 86400_000;
      const ultimas24h = db.prepare(`SELECT COUNT(*) AS n FROM alertas al JOIN agentes a ON a.id = al.agente_id
        WHERE al.aberto_em >= ? AND a.revogado = 0${f.sql}`).get(dia, ...f.args).n;
      return { abertos: linhas.reduce((n, l) => n + l.n, 0), porSeveridade, porTipo, ultimas24h };
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
  },
};
