// Camadas sobre a página: toasts, modais, gavetas (drawers) e confirmação. Foco preso, Esc fecha, foco volta ao gatilho.
import { h, focaveis, uid } from '../nucleo/dom.js';
import { icone } from '../nucleo/icones.js';
import { ErroApi } from '../nucleo/api.js';

// ------------------------------------------------------------------ toasts
/** toast('Script salvo.', 'sucesso'|'erro'|'aviso'|'info', { titulo, duracao }) */
export function toast(mensagem, tipo = 'info', { titulo, duracao = tipo === 'erro' ? 7000 : 4500 } = {}) {
  let area = document.getElementById('toasts');
  if (!area) { area = h('div', { id: 'toasts', class: 'toasts', 'aria-live': 'polite' }); document.body.append(area); }
  const ic = { sucesso: 'ok', erro: 'critico', aviso: 'aviso', info: 'info' }[tipo] ?? 'info';
  let saiu = false;
  const sair = () => {
    if (saiu) return;
    saiu = true;
    el.classList.add('saindo');
    setTimeout(() => el.remove(), 220);
  };
  const el = h('div', { class: `toast toast-${tipo}`, role: tipo === 'erro' ? 'alert' : 'status' },
    icone(ic),
    h('div', { class: 'toast-corpo' }, titulo ? h('div', { class: 'toast-titulo', text: titulo }) : null, h('div', { class: titulo ? 'toast-texto' : '', text: mensagem })),
    h('button', { class: 'btn-icone pequeno', 'aria-label': 'Fechar aviso', onclick: sair }, icone('fechar')));
  area.append(el);
  let t = setTimeout(sair, duracao);
  el.addEventListener('mouseenter', () => clearTimeout(t));
  el.addEventListener('mouseleave', () => { t = setTimeout(sair, 2000); });
  return sair;
}

export function toastErro(e) {
  if (e?.name === 'AbortError') return;
  toast(e instanceof ErroApi ? e.message : `Erro inesperado: ${e?.message ?? e}`, 'erro');
}

// ------------------------------------------------------------------ pilha de camadas (Esc fecha só a de cima)
const pilha = [];
document.addEventListener('keydown', (ev) => {
  const topo = pilha.at(-1);
  if (!topo) return;
  if (ev.key === 'Escape') { ev.preventDefault(); topo.fechar(null); }
  if (ev.key === 'Tab') {
    const f = focaveis(topo.el);
    if (!f.length) return;
    const [p, u] = [f[0], f.at(-1)];
    if (ev.shiftKey && document.activeElement === p) { ev.preventDefault(); u.focus(); }
    else if (!ev.shiftKey && document.activeElement === u) { ev.preventDefault(); p.focus(); }
    else if (!topo.el.contains(document.activeElement)) { ev.preventDefault(); p.focus(); }
  }
}, true);

function abrirCamada({ el, fundo, aoFechar }) {
  const anterior = document.activeElement;
  let resolver;
  const promessa = new Promise((r) => { resolver = r; });
  const camada = {
    el,
    fechar(valor = null) {
      const i = pilha.indexOf(camada);
      if (i < 0) return;
      pilha.splice(i, 1);
      fundo.classList.add('saindo');
      el.classList.add('saindo');
      setTimeout(() => { fundo.remove(); if (el.parentNode && el.parentNode !== fundo) el.remove(); }, 200);
      aoFechar?.(valor);
      anterior?.focus?.();
      resolver(valor);
    },
    promessa,
  };
  pilha.push(camada);
  requestAnimationFrame(() => {
    (el.querySelector('[autofocus]') || el.querySelector('input:not([type=checkbox]), textarea, select') || el.querySelector('.btn-primario') || el).focus?.();
  });
  return camada;
}

/**
 * Modal centralizado. conteudo recebe fechar(valor) e devolve nós.
 * const { promessa, fechar } = modal({ titulo, descricao, icone, tom: 'marca'|'perigo', largura: 'sm'|'md'|'lg', conteudo })
 */
export function modal({ titulo, descricao, icone: ic, tom = 'marca', largura = 'md', conteudo }) {
  const idTitulo = uid('modal');
  const fundo = h('div', { class: 'camada camada-modal' });
  const caixa = h('div', { class: `modal modal-${largura}`, role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': idTitulo, tabindex: -1 });
  fundo.append(caixa);
  document.body.append(fundo);
  const camada = abrirCamada({ el: caixa, fundo });
  caixa.append(
    h('header', { class: 'modal-cabecalho' },
      h('div', {}, ic ? h('div', { class: `modal-icone ${tom}` }, icone(ic)) : null, h('h2', { id: idTitulo, text: titulo }), descricao ? h('p', { text: descricao }) : null),
      h('button', { class: 'btn-icone', 'aria-label': 'Fechar', onclick: () => camada.fechar(null) }, icone('fechar'))),
    h('div', { class: 'modal-corpo' }, conteudo(camada.fechar)));
  fundo.addEventListener('mousedown', (ev) => { if (ev.target === fundo) camada.fechar(null); });
  return camada;
}

/**
 * Gaveta lateral (drawer). gaveta({ titulo, descricao, conteudo(fechar), rodape(fechar)?, larga })
 */
export function gaveta({ titulo, descricao, conteudo, rodape, larga = false }) {
  const idTitulo = uid('gaveta');
  const fundo = h('div', { class: 'camada' });
  const painel = h('aside', { class: ['gaveta', larga && 'larga'], role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': idTitulo, tabindex: -1 });
  document.body.append(fundo, painel);
  const camada = abrirCamada({ el: painel, fundo });
  painel.append(
    h('header', { class: 'gaveta-cabecalho' },
      h('div', { class: 'cresce' }, h('h2', { id: idTitulo, text: titulo }), descricao ? h('p', { text: descricao }) : null),
      h('button', { class: 'btn-icone', 'aria-label': 'Fechar', onclick: () => camada.fechar(null) }, icone('fechar'))),
    h('div', { class: 'gaveta-corpo' }, conteudo(camada.fechar)),
    rodape ? h('footer', { class: 'gaveta-rodape' }, rodape(camada.fechar)) : null);
  fundo.addEventListener('mousedown', () => camada.fechar(null));
  return camada;
}

/**
 * Confirmação. Com `digitar`, exige que o usuário digite o texto (ações destrutivas em massa).
 * await confirmar({ titulo, mensagem, rotulo, perigo, digitar })
 */
export function confirmar({ titulo, mensagem, rotulo = 'Confirmar', perigo = false, digitar = null, icone: ic }) {
  return modal({
    titulo, largura: 'sm', icone: ic ?? (perigo ? 'aviso' : 'info'), tom: perigo ? 'perigo' : 'marca',
    conteudo: (fechar) => {
      const ok = h('button', { class: perigo ? 'btn btn-perigo' : 'btn btn-primario', type: 'button', onclick: () => fechar(true), disabled: !!digitar }, rotulo);
      const campo = digitar ? h('input', { class: 'input mt-2', autocomplete: 'off', 'aria-label': `Digite ${digitar} para confirmar`,
        oninput: (ev) => { ok.disabled = ev.target.value.trim() !== digitar; } }) : null;
      return [
        typeof mensagem === 'string' ? h('p', { class: 'muted', text: mensagem }) : mensagem,
        digitar ? h('p', { class: 'pequeno mt-3' }, 'Digite ', h('strong', { class: 'mono', text: digitar }), ' para confirmar.') : null,
        campo,
        h('div', { class: 'modal-acoes' }, h('button', { class: 'btn', type: 'button', onclick: () => fechar(false) }, 'Cancelar'), ok),
      ];
    },
  }).promessa;
}
