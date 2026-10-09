// Estado global mínimo do painel + barramento de eventos em tempo real.

export const estado = {
  usuario: null,
  totpAtivo: false,
  elevadoAte: 0,
  alertasAbertos: 0,
};

const ouvintes = new Map();

/** Assina um tipo de evento do WebSocket ('checkin', 'agente', 'job', 'alerta', 'conexao'). Devolve função para cancelar. */
export function aoEvento(tipo, fn) {
  if (!ouvintes.has(tipo)) ouvintes.set(tipo, new Set());
  ouvintes.get(tipo).add(fn);
  return () => ouvintes.get(tipo)?.delete(fn);
}

export function emitir(tipo, dados) {
  for (const fn of ouvintes.get(tipo) ?? []) {
    try { fn(dados); } catch (e) { console.error(e); }
  }
}

let ws = null;
let tentativas = 0;
let ativo = false;

export function conectarTempoReal() {
  ativo = true;
  if (ws && ws.readyState <= 1) return;
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${proto}//${location.host}/api/ws`);
  ws.addEventListener('open', () => { tentativas = 0; emitir('conexao', true); });
  ws.addEventListener('message', (ev) => {
    try {
      const msg = JSON.parse(ev.data);
      if (msg.tipo) emitir(msg.tipo, msg.dados);
    } catch { /* mensagem malformada é ignorada */ }
  });
  ws.addEventListener('close', () => {
    emitir('conexao', false);
    if (!ativo) return;
    const espera = Math.min(30_000, 1000 * 2 ** tentativas++);
    setTimeout(conectarTempoReal, espera);
  });
}

export function desconectarTempoReal() {
  ativo = false;
  ws?.close();
  ws = null;
}
