// Camada visual da paleta de comandos (cortina + caixa), separada para reaproveitar a pilha de foco.
import { h } from '../nucleo/dom.js';

export function modalPaleta(busca, lista, rodape, aoFechar) {
  const anterior = document.activeElement;
  const fundo = h('div', { class: 'camada' });
  const caixa = h('div', { class: 'paleta', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Paleta de comandos' }, busca, lista, rodape);
  const fechar = () => {
    document.removeEventListener('keydown', teclas, true);
    fundo.remove();
    caixa.remove();
    aoFechar?.();
    anterior?.focus?.();
  };
  const teclas = (ev) => {
    if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); fechar(); }
    if (ev.key === 'Tab') ev.preventDefault();
  };
  fundo.addEventListener('mousedown', fechar);
  document.addEventListener('keydown', teclas, true);
  document.body.append(fundo, caixa);
  return { fechar };
}
