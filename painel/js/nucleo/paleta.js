// Paleta de comandos (Ctrl+K / ⌘K): páginas do menu, comandos registrados e buscadores dos módulos
// (dispositivos, scripts, biblioteca...). Teclado: ↑↓ navega, Enter executa, Esc fecha.
import { h, preencher, debounce } from './dom.js';
import { icone } from './icones.js';
import { registro, visiveis } from './registro.js';
import { normalizar } from './formato.js';
import { modalPaleta } from '../ui/paleta-camada.js';

let aberta = null;

export function iniciarAtalhosPaleta() {
  document.addEventListener('keydown', (ev) => {
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'k') { ev.preventDefault(); aberta ? aberta.fechar() : abrirPaleta(); }
    else if (ev.key === '/' && !aberta && !ev.target.closest?.('input, textarea, select, [contenteditable]')) { ev.preventDefault(); abrirPaleta(); }
  });
}

const corresponde = (termos, ...textos) => {
  const alvo = normalizar(textos.filter(Boolean).join(' '));
  return termos.every((t) => alvo.includes(t));
};

export function abrirPaleta(inicial = '') {
  if (aberta) return;
  const input = h('input', { type: 'text', placeholder: 'Buscar dispositivos, scripts, páginas e ações…', 'aria-label': 'Buscar',
    autocomplete: 'off', spellcheck: 'false', role: 'combobox', 'aria-expanded': 'true', 'aria-controls': 'paleta-lista', value: inicial });
  const lista = h('div', { class: 'paleta-lista', id: 'paleta-lista', role: 'listbox', 'aria-label': 'Resultados' });
  let resultados = [];
  let ativo = 0;
  let controle = null;

  const executar = (r) => {
    aberta?.fechar();
    if (r.href) location.hash = r.href.replace(/^#/, '');
    else r.executar?.();
  };

  const desenhar = () => {
    if (!resultados.length) {
      preencher(lista, h('div', { class: 'paleta-vazio' }, input.value.trim() ? 'Nada encontrado.' : 'Comece a digitar…'));
      return;
    }
    const frag = [];
    let secao = null;
    resultados.forEach((r, i) => {
      if (r.secao !== secao) { secao = r.secao; frag.push(h('div', { class: 'paleta-grupo', role: 'presentation', text: secao })); }
      const item = h('button', { class: 'paleta-item', type: 'button', role: 'option', id: `paleta-op-${i}`, 'aria-selected': String(i === ativo), tabindex: -1,
        onclick: () => executar(r), onmousemove: () => { if (ativo !== i) { ativo = i; marcar(); } } },
      h('span', { class: 'paleta-icone' }, r.iconeNo ?? icone(r.icone ?? 'seta')),
      h('span', { class: 'paleta-texto' }, h('span', { text: r.rotulo }), r.descricao ? h('small', { text: r.descricao }) : null),
      h('span', { class: 'paleta-seta' }, icone('seta', { tamanho: 14 })));
      frag.push(item);
    });
    preencher(lista, frag);
    marcar();
  };
  const marcar = () => {
    lista.querySelectorAll('.paleta-item').forEach((el, i) => el.setAttribute('aria-selected', String(i === ativo)));
    input.setAttribute('aria-activedescendant', `paleta-op-${ativo}`);
    lista.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  };

  const buscar = async () => {
    const q = input.value.trim();
    const termos = normalizar(q).split(/\s+/).filter(Boolean);
    const paginas = visiveis(registro.menu).filter((m) => corresponde(termos, m.rotulo, m.secao))
      .map((m) => ({ secao: 'Páginas', rotulo: m.rotulo, descricao: m.secao, icone: m.icone, href: m.href }));
    const comandos = visiveis(registro.comandos).filter((c) => corresponde(termos, c.rotulo, c.descricao, c.palavras))
      .map((c) => ({ secao: c.secao, rotulo: c.rotulo, descricao: c.descricao, icone: c.icone, executar: c.executar }));
    resultados = [...(q ? [] : []), ...comandos.slice(0, q ? 8 : 6), ...paginas.slice(0, q ? 6 : 12)];
    ativo = 0;
    desenhar();
    if (!q) return;
    controle?.abort();
    controle = new AbortController();
    const sinal = controle.signal;
    const fontes = visiveis(registro.buscadores);
    const respostas = await Promise.all(fontes.map((b) => Promise.resolve(b.buscar(q, sinal)).catch(() => [])
      .then((itens) => (itens ?? []).slice(0, 6).map((i) => ({ ...i, secao: b.secao })))));
    if (sinal.aborted) return;
    resultados = [...respostas.flat(), ...comandos.slice(0, 6), ...paginas.slice(0, 6)];
    ativo = 0;
    desenhar();
  };
  const buscarDepois = debounce(buscar, 140);

  input.addEventListener('input', buscarDepois);
  input.addEventListener('keydown', (ev) => {
    if (ev.key === 'ArrowDown') { ev.preventDefault(); ativo = Math.min(resultados.length - 1, ativo + 1); marcar(); }
    else if (ev.key === 'ArrowUp') { ev.preventDefault(); ativo = Math.max(0, ativo - 1); marcar(); }
    else if (ev.key === 'Enter') { ev.preventDefault(); if (resultados[ativo]) executar(resultados[ativo]); }
  });

  aberta = modalPaleta(h('div', { class: 'paleta-busca' }, icone('busca'), input, h('kbd', { text: 'Esc' })), lista,
    h('div', { class: 'paleta-rodape' }, h('span', {}, h('kbd', { text: '↑' }), h('kbd', { text: '↓' }), 'navegar'),
      h('span', {}, h('kbd', { text: 'Enter' }), 'abrir'), h('span', {}, h('kbd', { text: 'Esc' }), 'fechar')),
    () => { aberta = null; controle?.abort(); });
  buscar();
  requestAnimationFrame(() => input.focus());
}
