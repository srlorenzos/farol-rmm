// Elementos flutuantes: menus suspensos e de contexto (teclado completo) e dicas (tooltips).
import { h } from '../nucleo/dom.js';
import { icone } from '../nucleo/icones.js';

/** Posiciona `el` (position: fixed) junto à âncora (elemento ou {x, y}), sem sair da janela. */
export function posicionar(el, ancora, { alinhar = 'inicio', lado = 'baixo', margem = 6 } = {}) {
  const r = ancora instanceof Element ? ancora.getBoundingClientRect() : { left: ancora.x, right: ancora.x, top: ancora.y, bottom: ancora.y, width: 0, height: 0 };
  const largura = el.offsetWidth;
  const altura = el.offsetHeight;
  let x = alinhar === 'fim' ? r.right - largura : r.left;
  let y = lado === 'cima' ? r.top - altura - margem : r.bottom + margem;
  if (y + altura > innerHeight - 8) y = Math.max(8, r.top - altura - margem);
  x = Math.max(8, Math.min(x, innerWidth - largura - 8));
  el.style.left = `${Math.round(x)}px`;
  el.style.top = `${Math.round(Math.max(8, y))}px`;
}

let abertoAtual = null;

/**
 * Abre um menu. itens: [{ rotulo, icone, onclick, perigo, desabilitado, dica, marcado, href }, '-', { titulo: 'Seção' }]
 * ou um nó pronto (conteudo). Fecha em Esc, clique fora, Tab. Setas navegam.
 */
export function abrirMenu(ancora, itens, { alinhar = 'inicio', classe, conteudo, aoFechar, rotulo = 'Menu' } = {}) {
  abertoAtual?.fechar();
  const el = h('div', { class: ['flutuante', classe], role: conteudo ? 'dialog' : 'menu', 'aria-label': rotulo, tabindex: -1 });
  const fechar = (focarAncora = true) => {
    if (!el.isConnected) return;
    el.remove();
    document.removeEventListener('mousedown', fora, true);
    document.removeEventListener('keydown', teclas, true);
    window.removeEventListener('resize', fecharSemFoco);
    if (ancora instanceof Element) { ancora.setAttribute('aria-expanded', 'false'); if (focarAncora) ancora.focus(); }
    if (abertoAtual?.el === el) abertoAtual = null;
    aoFechar?.();
  };
  const fecharSemFoco = () => fechar(false);
  if (conteudo) el.append(typeof conteudo === 'function' ? conteudo(fechar) : conteudo);
  else {
    for (const it of itens) {
      if (it === '-') { el.append(h('div', { class: 'menu-sep', role: 'separator' })); continue; }
      if (it.titulo) { el.append(h('div', { class: 'menu-titulo', text: it.titulo })); continue; }
      const attrs = {
        class: ['menu-item', it.perigo && 'perigo', it.classe], role: it.marcado != null ? 'menuitemcheckbox' : 'menuitem', tabindex: -1,
        'aria-disabled': it.desabilitado ? 'true' : null, 'aria-checked': it.marcado != null ? String(!!it.marcado) : null,
        'data-dica': it.dica ?? null,
      };
      const filhos = [it.icone ? icone(it.icone) : null, h('span', { text: it.rotulo }), it.atalho ? h('span', { class: 'menu-dica', text: it.atalho }) : null];
      const item = it.href ? h('a', { ...attrs, href: it.href }, filhos) : h('button', { ...attrs, type: 'button' }, filhos);
      item.addEventListener('click', (ev) => {
        if (it.desabilitado) return;
        if (it.manterAberto) { it.onclick?.(ev); return; }
        fechar(!it.href);
        it.onclick?.(ev);
      });
      el.append(item);
    }
  }
  document.body.append(el);
  posicionar(el, ancora, { alinhar });
  if (ancora instanceof Element) ancora.setAttribute('aria-expanded', 'true');
  const itensFoco = () => [...el.querySelectorAll('.menu-item:not([aria-disabled="true"]), input, button:not(.menu-item)')];
  requestAnimationFrame(() => (itensFoco()[0] ?? el).focus());
  const fora = (ev) => { if (!el.contains(ev.target) && !(ancora instanceof Element && ancora.contains(ev.target))) fechar(false); };
  const teclas = (ev) => {
    if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); fechar(); return; }
    if (ev.key === 'Tab') { fechar(false); return; }
    if (conteudo) return;
    const lista = itensFoco();
    const i = lista.indexOf(document.activeElement);
    if (ev.key === 'ArrowDown') { ev.preventDefault(); lista[(i + 1) % lista.length]?.focus(); }
    if (ev.key === 'ArrowUp') { ev.preventDefault(); lista[(i - 1 + lista.length) % lista.length]?.focus(); }
    if (ev.key === 'Home') { ev.preventDefault(); lista[0]?.focus(); }
    if (ev.key === 'End') { ev.preventDefault(); lista.at(-1)?.focus(); }
  };
  setTimeout(() => document.addEventListener('mousedown', fora, true));
  document.addEventListener('keydown', teclas, true);
  window.addEventListener('resize', fecharSemFoco);
  abertoAtual = { el, fechar };
  return { el, fechar };
}

/** Liga um botão a um menu (aria-haspopup, toggle). */
export function botaoMenu(botao, itensOuFn, opcoes = {}) {
  botao.setAttribute('aria-haspopup', opcoes.conteudo ? 'dialog' : 'menu');
  botao.setAttribute('aria-expanded', 'false');
  botao.addEventListener('click', (ev) => {
    ev.stopPropagation();
    if (botao.getAttribute('aria-expanded') === 'true') { abertoAtual?.fechar(); return; }
    abrirMenu(botao, typeof itensOuFn === 'function' ? itensOuFn() : itensOuFn, opcoes);
  });
  return botao;
}

/** Menu de contexto (botão direito / Shift+F10) em `alvo`. */
export function menuContexto(alvo, itensFn) {
  alvo.addEventListener('contextmenu', (ev) => {
    const itens = itensFn(ev);
    if (!itens?.length) return;
    ev.preventDefault();
    abrirMenu({ x: ev.clientX, y: ev.clientY }, itens, { rotulo: 'Ações' });
  });
}

// ------------------------------------------------------------------ dicas (tooltips) por delegação: atributo data-dica
let dica = null;
let timerDica = null;
function mostrarDica(alvo) {
  const texto = alvo.getAttribute('data-dica');
  if (!texto) return;
  esconderDica();
  dica = h('div', { class: 'dica', role: 'tooltip', text: texto });
  document.body.append(dica);
  const r = alvo.getBoundingClientRect();
  const x = Math.max(8, Math.min(r.left + r.width / 2 - dica.offsetWidth / 2, innerWidth - dica.offsetWidth - 8));
  let y = r.top - dica.offsetHeight - 8;
  if (y < 8) y = r.bottom + 8;
  dica.style.left = `${x}px`;
  dica.style.top = `${y}px`;
}
function esconderDica() { clearTimeout(timerDica); dica?.remove(); dica = null; }

export function ativarDicas() {
  document.addEventListener('pointerover', (ev) => {
    const alvo = ev.target.closest?.('[data-dica]');
    if (!alvo || ev.pointerType === 'touch') return;
    clearTimeout(timerDica);
    timerDica = setTimeout(() => mostrarDica(alvo), 380);
  });
  document.addEventListener('pointerout', (ev) => { if (ev.target.closest?.('[data-dica]')) esconderDica(); });
  document.addEventListener('focusin', (ev) => { const a = ev.target.closest?.('[data-dica]'); if (a && a.matches(':focus-visible')) mostrarDica(a); });
  document.addEventListener('focusout', esconderDica);
  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') esconderDica(); });
  document.addEventListener('scroll', esconderDica, true);
}
