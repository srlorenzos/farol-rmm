// Estado global mínimo, barramento de eventos e conexão em tempo real (WebSocket) com o servidor.
import { lerPreferencia, salvarPreferencia, uid } from './dom.js';

export const estado = {
  usuario: null,
  nome: null,
  papel: null,
  permissoes: new Set(),
  totpAtivo: false,
  elevadoAte: 0,
  versao: '',
  alertasAbertos: 0,
  conectado: false,
  /** Escopo cliente/site escolhido no topo: { cliente?: number, site?: number, rotulo?: string } */
  escopo: lerPreferencia('escopo', {}) || {},
  clientes: [],
};

export const pode = (perm) => estado.papel === 'admin' || estado.permissoes.has(perm);

// ---------- barramento ----------
const ouvintes = new Map();

/**
 * Assina um evento. Do servidor: 'checkin', 'agente', 'agente.canal', 'job', 'alerta', 'comando', 'organizacao', 'relay'.
 * Locais: 'conexao', 'escopo', 'tema', 'elevado'. Devolve a função que cancela a assinatura.
 */
export function aoEvento(tipo, fn) {
  if (!ouvintes.has(tipo)) ouvintes.set(tipo, new Set());
  ouvintes.get(tipo).add(fn);
  return () => ouvintes.get(tipo)?.delete(fn);
}

export function emitir(tipo, dados) {
  for (const fn of [...(ouvintes.get(tipo) ?? [])]) {
    try { fn(dados); } catch (e) { console.error(e); }
  }
}

// ---------- escopo cliente/site ----------
export function definirEscopo(escopo) {
  estado.escopo = escopo?.cliente || escopo?.site ? escopo : {};
  salvarPreferencia('escopo', estado.escopo);
  emitir('escopo', estado.escopo);
}

/** Parâmetros de escopo para a API: { cliente } ou { site } (ou {}). */
export function paramsEscopo() {
  const e = estado.escopo;
  return e.site ? { site: e.site } : e.cliente ? { cliente: e.cliente } : {};
}

// ---------- WebSocket ----------
let ws = null;
let tentativas = 0;
let ativo = false;
let timer = null;

export function conectarTempoReal() {
  ativo = true;
  if (ws && ws.readyState <= 1) return;
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${proto}//${location.host}/api/ws`);
  ws.addEventListener('open', () => { tentativas = 0; estado.conectado = true; emitir('conexao', true); });
  ws.addEventListener('message', (ev) => {
    try {
      const msg = JSON.parse(ev.data);
      if (msg.tipo) emitir(msg.tipo, msg.dados);
    } catch { /* mensagem malformada é ignorada */ }
  });
  ws.addEventListener('close', () => {
    estado.conectado = false;
    emitir('conexao', false);
    if (!ativo) return;
    clearTimeout(timer);
    timer = setTimeout(conectarTempoReal, Math.min(30_000, 1000 * 2 ** tentativas++));
  });
}

export function desconectarTempoReal() {
  ativo = false;
  clearTimeout(timer);
  ws?.close();
  ws = null;
}

/** Envia uma mensagem {t, ...} ao servidor pelo WebSocket. */
export function enviarWs(msg) {
  if (!ws || ws.readyState !== 1) return false;
  ws.send(JSON.stringify(msg));
  return true;
}

/**
 * Abre uma sessão de relay com um agente (tipos registrados no servidor, ex.: 'eco', 'terminal').
 *   const s = await abrirSessao(agenteId, 'eco', {}, { aoDados: (d) => ..., aoFechar: (motivo) => ... });
 *   s.enviar('ping'); s.fechar();
 * Rejeita com Error (com .precisaElevar/.precisa2fa quando for o caso).
 */
export function abrirSessao(agenteId, tipo, args = {}, { aoDados = () => {}, aoFechar = () => {} } = {}) {
  return new Promise((resolver, rejeitar) => {
    const ref = uid('relay');
    let id = null;
    const parar = aoEvento('relay', (m) => {
      if (m.ref === ref && m.e === 'abrindo') id = m.sessao;
      else if (m.ref === ref && m.e === 'erro') { parar(); rejeitar(Object.assign(new Error(m.erro), m)); }
      else if (m.ref === ref && m.e === 'aberta') {
        id = m.sessao;
        resolver({
          id,
          enviar: (d) => enviarWs({ t: 'relay.dados', sessao: id, d }),
          fechar: () => { enviarWs({ t: 'relay.fechar', sessao: id }); },
        });
      } else if (id && m.sessao === id && m.e === 'dados') aoDados(m.d);
      else if (id && m.sessao === id && m.e === 'fechada') { parar(); aoFechar(m.motivo); if (m.ref === ref) rejeitar(new Error(m.motivo)); }
    });
    if (!enviarWs({ t: 'relay.abrir', ref, agente_id: agenteId, tipo, args })) {
      parar();
      rejeitar(new Error('Sem conexão em tempo real com o servidor'));
    }
  });
}
