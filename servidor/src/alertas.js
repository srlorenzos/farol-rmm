// Motor de alertas: regras globais avaliadas a cada check-in e periodicamente (offline).
import { lerConfig } from './db.js';
import { REGRAS_PADRAO } from './sementes.js';

export function regrasAtuais(db) {
  const salvas = lerConfig(db, 'regras', {});
  const r = {};
  for (const k of Object.keys(REGRAS_PADRAO)) r[k] = { ...REGRAS_PADRAO[k], ...(salvas[k] || {}) };
  return r;
}

export function webhookAtual(ctx) {
  return lerConfig(ctx.db, 'webhook_url', null) ?? ctx.config.webhookUrl ?? '';
}

export function abrirAlerta(ctx, agente, tipo, mensagem, valor = null) {
  const { db } = ctx;
  const aberto = db.prepare("SELECT id FROM alertas WHERE agente_id = ? AND tipo = ? AND status = 'aberto'").get(agente.id, tipo);
  if (aberto) {
    db.prepare('UPDATE alertas SET valor = ?, mensagem = ? WHERE id = ?').run(valor, mensagem, aberto.id);
    return null;
  }
  const agora = Date.now();
  const { lastInsertRowid } = db.prepare(`INSERT INTO alertas (agente_id, tipo, mensagem, valor, status, aberto_em)
    VALUES (?, ?, ?, ?, 'aberto', ?)`).run(agente.id, tipo, mensagem, valor, agora);
  const alerta = { id: Number(lastInsertRowid), agente_id: agente.id, hostname: agente.hostname, tipo, mensagem, valor, status: 'aberto', aberto_em: agora };
  ctx.hub.emitir('alerta', alerta);
  enviarWebhook(ctx, alerta);
  return alerta;
}

export function resolverAlerta(ctx, agente, tipo) {
  const agora = Date.now();
  const abertos = ctx.db.prepare("SELECT id FROM alertas WHERE agente_id = ? AND tipo = ? AND status = 'aberto'").all(agente.id, tipo);
  for (const { id } of abertos) {
    ctx.db.prepare("UPDATE alertas SET status = 'resolvido', resolvido_em = ? WHERE id = ?").run(agora, id);
    ctx.hub.emitir('alerta', { id, agente_id: agente.id, hostname: agente.hostname, tipo, status: 'resolvido', resolvido_em: agora });
  }
  return abertos.length;
}

const NOMES = { cpu: 'CPU', ram: 'Memória', disco: 'Disco', offline: 'Offline' };

/** Avalia CPU/RAM/disco de um check-in. `agente` é a linha antes da atualização. */
export function avaliarMetricas(ctx, agente, { cpu, ramPct, discoMax, discoPonto }) {
  const regras = regrasAtuais(ctx.db);
  const seqs = {};
  for (const [tipo, valor, coluna] of [['cpu', cpu, 'cpu_seq'], ['ram', ramPct, 'ram_seq']]) {
    const regra = regras[tipo];
    if (regra.ativo && valor != null && valor > regra.limite) {
      seqs[coluna] = (agente[coluna] || 0) + 1;
      if (seqs[coluna] >= regra.ciclos) {
        abrirAlerta(ctx, agente, tipo,
          `${NOMES[tipo]} em ${valor.toFixed(0)}% (limite ${regra.limite}%) por ${seqs[coluna]} check-ins seguidos`, valor);
      }
    } else {
      seqs[coluna] = 0;
      resolverAlerta(ctx, agente, tipo);
    }
  }
  ctx.db.prepare('UPDATE agentes SET cpu_seq = ?, ram_seq = ? WHERE id = ?').run(seqs.cpu_seq, seqs.ram_seq, agente.id);

  const rd = regras.disco;
  if (rd.ativo && discoMax != null && discoMax > rd.limite) {
    abrirAlerta(ctx, agente, 'disco', `Disco ${discoPonto ?? ''} em ${discoMax.toFixed(0)}% (limite ${rd.limite}%)`.replace('  ', ' '), discoMax);
  } else {
    resolverAlerta(ctx, agente, 'disco');
  }
}

/** Marca agentes sem check-in como offline e abre alertas de offline prolongado. */
export function verificarOffline(ctx, agora = Date.now()) {
  const { db, hub, config } = ctx;
  const limite = agora - config.offlineSegundos * 1000;
  const caidos = db.prepare(`SELECT id, hostname FROM agentes
    WHERE revogado = 0 AND status = 'online' AND ultimo_checkin < ?`).all(limite);
  for (const a of caidos) {
    db.prepare("UPDATE agentes SET status = 'offline' WHERE id = ?").run(a.id);
    hub.emitir('agente', { id: a.id, hostname: a.hostname, status: 'offline' });
  }
  const regra = regrasAtuais(db).offline;
  if (regra.ativo) {
    const antigos = db.prepare(`SELECT id, hostname, ultimo_checkin FROM agentes
      WHERE revogado = 0 AND status = 'offline' AND ultimo_checkin < ?`).all(agora - regra.minutos * 60_000);
    for (const a of antigos) {
      const min = Math.floor((agora - a.ultimo_checkin) / 60_000);
      abrirAlerta(ctx, a, 'offline', `Sem check-in há ${min} min (limite ${regra.minutos} min)`, min);
    }
  }
  return caidos.length;
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
