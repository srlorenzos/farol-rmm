// Montagem de DOM sem innerHTML: tudo é createElement + textContent (dados nunca viram HTML).

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * h('button', { class: 'btn', onclick: fn, 'aria-label': 'x' }, 'texto', filho)
 * - class aceita lista (valores falsos são ignorados) · text define textContent · dataset/estilo são objetos
 * - on<evento> com função vira addEventListener · valores null/false não criam o atributo
 */
export function h(tag, attrs = {}, ...filhos) {
  const el = document.createElement(tag);
  aplicar(el, attrs);
  anexar(el, filhos);
  return el;
}

/** Igual a h(), no namespace SVG. */
export function s(tag, attrs = {}, ...filhos) {
  const el = document.createElementNS(SVG_NS, tag);
  aplicar(el, attrs);
  anexar(el, filhos);
  return el;
}

function aplicar(el, attrs) {
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.setAttribute('class', Array.isArray(v) ? v.filter(Boolean).join(' ') : v);
    else if (k === 'text') el.textContent = v;
    else if (k === 'value') el.value = v;
    else if (k === 'checked') el.checked = !!v;
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k === 'estilo') Object.assign(el.style, v); // CSSOM: permitido pela CSP (sem style inline)
    else if (k === 'ref' && typeof v === 'function') v(el);
    else el.setAttribute(k, v === true ? '' : String(v));
  }
}

function anexar(el, filhos) {
  for (const f of filhos.flat(Infinity)) {
    if (f == null || f === false || f === true) continue;
    el.append(f instanceof Node ? f : document.createTextNode(String(f)));
  }
}

export function limpar(el) {
  while (el.firstChild) el.firstChild.remove();
  return el;
}

/** Limpa e anexa os filhos (aceita listas aninhadas). */
export function preencher(el, ...filhos) {
  limpar(el);
  anexar(el, filhos);
  return el;
}

export function debounce(fn, ms = 200) {
  let t;
  const f = (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  f.cancelar = () => clearTimeout(t);
  return f;
}

let contador = 0;
export const uid = (prefixo = 'f') => `${prefixo}-${(++contador).toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

/** Preferências do usuário (localStorage pode falhar: modo privado, bloqueado). */
export function lerPreferencia(chave, padrao = null) {
  try { const v = localStorage.getItem(`farol:${chave}`); return v == null ? padrao : JSON.parse(v); } catch { return padrao; }
}
export function salvarPreferencia(chave, valor) {
  try { localStorage.setItem(`farol:${chave}`, JSON.stringify(valor)); } catch { /* armazenamento indisponível */ }
}

/** Elementos focáveis dentro de um contêiner (para prender o foco em modais). */
export function focaveis(raiz) {
  return [...raiz.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')]
    .filter((e) => !e.disabled && !e.closest('[hidden]') && e.getClientRects().length);
}
