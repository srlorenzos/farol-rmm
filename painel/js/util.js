// Utilitários do painel. Toda a interface é montada com nós DOM e textContent —
// nada de innerHTML com dados vindos do servidor.

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Cria um elemento: h('button', { class: 'btn', onclick: fn, 'aria-label': 'x' }, 'texto', filho).
 * Strings viram nós de texto (escapadas automaticamente).
 */
export function h(tag, attrs = {}, ...filhos) {
  const el = document.createElement(tag);
  aplicarAtributos(el, attrs);
  anexar(el, filhos);
  return el;
}

/** Igual a h(), mas no namespace SVG. */
export function s(tag, attrs = {}, ...filhos) {
  const el = document.createElementNS(SVG_NS, tag);
  aplicarAtributos(el, attrs);
  anexar(el, filhos);
  return el;
}

function aplicarAtributos(el, attrs) {
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.setAttribute('class', Array.isArray(v) ? v.filter(Boolean).join(' ') : v);
    else if (k === 'text') el.textContent = v;
    else if (k === 'value') el.value = v;
    else if (k === 'checked') el.checked = !!v;
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k === 'estilo') Object.assign(el.style, v); // CSSOM: permitido pela CSP
    else el.setAttribute(k, v === true ? '' : String(v));
  }
}

function anexar(el, filhos) {
  for (const f of filhos.flat(Infinity)) {
    if (f == null || f === false) continue;
    el.append(f instanceof Node ? f : document.createTextNode(String(f)));
  }
}

export function limpar(el) {
  while (el.firstChild) el.firstChild.remove();
  return el;
}

/** Limpa o elemento e anexa os filhos (aceita listas aninhadas). */
export function preencher(el, ...filhos) {
  limpar(el);
  anexar(el, filhos);
  return el;
}

// ---------- Ícones (traços próprios, 24×24) ----------
const ICONES = {
  visao: ['M4 4h7v7H4z', 'M13 4h7v4h-7z', 'M13 10h7v10h-7z', 'M4 13h7v7H4z'],
  agentes: ['M3 5h18v11H3z', 'M8 20h8', 'M12 16v4'],
  scripts: ['M4 5h16v14H4z', 'M8 10l2 2-2 2', 'M12 14h4'],
  alertas: ['M6 16V11a6 6 0 0112 0v5l2 2H4z', 'M10 20a2 2 0 004 0'],
  auditoria: ['M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z', 'M9 12l2 2 4-4'],
  config: ['M12 9a3 3 0 100 6 3 3 0 000-6z', 'M19 12a7 7 0 00-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 00-2-1.2L14 3h-4l-.5 2.6a7 7 0 00-2 1.2l-2.4-1-2 3.4 2 1.6a7 7 0 000 2.4l-2 1.6 2 3.4 2.4-1a7 7 0 002 1.2L10 21h4l.5-2.6a7 7 0 002-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2z'],
  sol: ['M12 8a4 4 0 100 8 4 4 0 000-8z', 'M12 2v2', 'M12 20v2', 'M4.9 4.9l1.4 1.4', 'M17.7 17.7l1.4 1.4', 'M2 12h2', 'M20 12h2', 'M4.9 19.1l1.4-1.4', 'M17.7 6.3l1.4-1.4'],
  lua: ['M20 14.5A8 8 0 019.5 4 8 8 0 1020 14.5z'],
  sair: ['M15 4h4v16h-4', 'M10 8l-4 4 4 4', 'M6 12h10'],
  menu: ['M4 6h16', 'M4 12h16', 'M4 18h16'],
  busca: ['M11 4a7 7 0 100 14 7 7 0 000-14z', 'M20 20l-4-4'],
  play: ['M7 5l12 7-12 7z'],
  mais: ['M12 5v14', 'M5 12h14'],
  lixo: ['M4 7h16', 'M10 11v6', 'M14 11v6', 'M6 7l1 13h10l1-13', 'M9 7V4h6v3'],
  copiar: ['M9 9h11v11H9z', 'M5 15H4V4h11v1'],
  fechar: ['M6 6l12 12', 'M18 6L6 18'],
  check: ['M5 12l5 5 9-10'],
  terminal: ['M4 6l5 6-5 6', 'M12 18h8'],
  chave: ['M14 10a4 4 0 10-3.5 4L9 16H7v2H5v2H3v-3l7-7', 'M15 7h.01'],
  voltar: ['M15 6l-6 6 6 6'],
  chevron: ['M9 6l6 6-6 6'],
  revogar: ['M12 3a9 9 0 100 18 9 9 0 000-18z', 'M5.6 5.6l12.8 12.8'],
  editar: ['M4 20h4L19 9l-4-4L4 16z', 'M13 7l4 4'],
  info: ['M12 3a9 9 0 100 18 9 9 0 000-18z', 'M12 11v6', 'M12 7h.01'],
  aviso: ['M12 3l10 18H2z', 'M12 10v4', 'M12 17h.01'],
  farol: ['M10 21l.8-11h2.4l.8 11z', 'M9.5 10h5', 'M10.5 4.5h3V10h-3z', 'M12 2.5v2', 'M3.5 5.5l5 1.5', 'M20.5 5.5l-5 1.5', 'M3.5 9.5l5-1', 'M20.5 9.5l-5-1', 'M6 21h12'],
  atualizar: ['M20 11a8 8 0 10-2.3 5.7', 'M20 5v6h-6'],
};

export function icone(nome, { tamanho = 18, rotulo } = {}) {
  const svg = s('svg', {
    viewBox: '0 0 24 24', width: tamanho, height: tamanho, fill: 'none', stroke: 'currentColor',
    'stroke-width': 1.8, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', class: 'icone',
    ...(rotulo ? { role: 'img', 'aria-label': rotulo } : { 'aria-hidden': 'true', focusable: 'false' }),
  });
  for (const d of ICONES[nome] || []) svg.append(s('path', { d }));
  return svg;
}

// ---------- Formatação ----------
const nf1 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });
const nf0 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });

export function fmtPct(v) { return v == null ? '—' : `${nf0.format(v)}%`; }
export function fmtNum(v, casas = 1) {
  return v == null ? '—' : (casas ? nf1 : nf0).format(v);
}

export function fmtBytes(b) {
  if (b == null) return '—';
  const u = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  let i = 0;
  let v = Number(b);
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${(i >= 3 ? nf1 : nf0).format(v)} ${u[i]}`;
}

export function fmtDuracao(seg) {
  if (seg == null) return '—';
  const d = Math.floor(seg / 86400);
  const hrs = Math.floor((seg % 86400) / 3600);
  const min = Math.floor((seg % 3600) / 60);
  if (d) return `${d}d ${hrs}h`;
  if (hrs) return `${hrs}h ${min}min`;
  return `${min} min`;
}

export function fmtMs(ms) {
  if (ms == null) return '—';
  return ms < 1000 ? `${ms} ms` : `${nf1.format(ms / 1000)} s`;
}

const dtf = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'medium' });
const hf = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });
export function fmtData(ms) { return ms ? dtf.format(new Date(ms)) : '—'; }
export function fmtHora(ms) { return hf.format(new Date(ms)); }

const rtf = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' });
export function relativo(ms) {
  if (!ms) return 'nunca';
  const seg = Math.round((ms - Date.now()) / 1000);
  const abs = Math.abs(seg);
  if (abs < 10) return 'agora';
  if (abs < 60) return rtf.format(seg, 'second');
  if (abs < 3600) return rtf.format(Math.round(seg / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(seg / 3600), 'hour');
  return rtf.format(Math.round(seg / 86400), 'day');
}

export function ramPct(a) {
  return a.ram_total ? (a.ram_usada / a.ram_total) * 100 : null;
}

export function debounce(fn, ms = 200) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

export function lerPreferencia(chave, padrao = null) {
  try { return localStorage.getItem(chave) ?? padrao; } catch { return padrao; }
}
export function salvarPreferencia(chave, valor) {
  try { localStorage.setItem(chave, valor); } catch { /* armazenamento indisponível */ }
}

export const NOMES_SHELL = { powershell: 'PowerShell', cmd: 'CMD', bash: 'Bash', python: 'Python' };
