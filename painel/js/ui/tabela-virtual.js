// Tabela virtual: só as linhas visíveis ficam no DOM (aguenta dezenas de milhares), cabeçalho fixo,
// ordenação, seleção múltipla (clique, Shift+clique, Espaço), agrupamento, teclado e menu de contexto.
import { h, limpar } from '../nucleo/dom.js';
import { icone } from '../nucleo/icones.js';
import { menuContexto } from './flutuante.js';

const ALTURA = 40;
const SOBRA = 8;

/**
 * @param {object} o
 * @param {Array<{id, rotulo, largura?, render(l), valor?(l), num?, ordenavel?}>} o.colunas
 * @param {(l) => string} o.chave
 * @param {boolean} [o.selecionavel]
 * @param {(sel: Set) => void} [o.aoSelecionar]
 * @param {(l) => {chave, rotulo}|null} [o.agrupar]
 * @param {(l) => void} [o.aoAbrir]               Enter ou duplo clique (ou clique simples com abrirComClique)
 * @param {(l, selecionadas) => Array} [o.menu]   itens do menu de contexto
 * @param {() => Node} [o.vazio]
 * @param {{coluna, direcao: 'asc'|'desc'}} [o.ordem]
 * @param {(ordem) => void} [o.aoOrdenar]
 * @param {string} [o.rotulo]                     nome acessível da tabela
 */
export function tabelaVirtual(o) {
  let colunas = o.colunas;
  let linhas = [];
  let itens = []; // linhas + cabeçalhos de grupo, já ordenados
  let ordem = o.ordem ?? null;
  const sel = new Set();
  let ancoraShift = null;
  let foco = 0;
  const recolhidos = new Set();

  const cabecalho = h('div', { class: 'tv-cabecalho', role: 'row' });
  const corpo = h('div', { class: 'tv-corpo', role: 'rowgroup' });
  const rolagem = h('div', { class: 'tv-rolagem', tabindex: -1 }, cabecalho, corpo);
  const rodape = h('div', { class: 'tv-rodape', 'aria-live': 'polite' });
  const vazioEl = h('div', { hidden: true });
  const el = h('div', { class: 'tv', role: 'grid', 'aria-label': o.rotulo ?? 'Tabela', 'aria-multiselectable': o.selecionavel ? 'true' : null }, rolagem, vazioEl, rodape);

  const larguras = () => [o.selecionavel ? '44px' : null, ...colunas.map((c) => c.largura ?? 'minmax(120px, 1fr)')].filter(Boolean);
  const grade = () => larguras().join(' ');
  /** Largura mínima da grade (soma dos mínimos): cabeçalho e linhas usam a mesma, senão as colunas "fr" desalinham. */
  const larguraMinima = () => larguras().reduce((n, l) => n + (Number((/(\d+)px/.exec(l) ?? [])[1]) || 120), 0);

  function desenharCabecalho() {
    limpar(cabecalho);
    cabecalho.style.gridTemplateColumns = grade();
    cabecalho.style.minWidth = corpo.style.minWidth = `${larguraMinima()}px`;
    if (o.selecionavel) {
      const todos = h('input', { type: 'checkbox', class: 'check', 'aria-label': 'Selecionar todas as linhas filtradas' });
      const n = linhas.length;
      todos.checked = n > 0 && linhas.every((l) => sel.has(o.chave(l)));
      todos.indeterminate = !todos.checked && linhas.some((l) => sel.has(o.chave(l)));
      todos.addEventListener('change', () => {
        for (const l of linhas) (todos.checked ? sel.add(o.chave(l)) : sel.delete(o.chave(l)));
        mudouSelecao();
      });
      cabecalho.append(h('div', { class: 'tv-celula', role: 'columnheader' }, todos));
    }
    for (const c of colunas) {
      const ordenavel = c.ordenavel ?? !!c.valor;
      const ativa = ordem?.coluna === c.id;
      const cel = h('div', {
        class: ['tv-celula', c.num && 'num', ordenavel && 'th-ordenavel'], role: 'columnheader',
        'aria-sort': ativa ? (ordem.direcao === 'asc' ? 'ascending' : 'descending') : null,
        tabindex: ordenavel ? 0 : null,
      }, c.rotulo ? h('span', { text: c.rotulo }) : h('span', { class: 'sr', text: c.rotuloAria ?? c.id }),
      ordenavel ? h('span', { class: 'seta', 'aria-hidden': 'true' }, icone('chevron-baixo', { tamanho: 12 })) : null);
      if (ordenavel) {
        const alternar = () => {
          ordem = ativa && ordem.direcao === 'asc' ? { coluna: c.id, direcao: 'desc' } : { coluna: c.id, direcao: 'asc' };
          o.aoOrdenar?.(ordem);
          recalcular();
        };
        cel.addEventListener('click', alternar);
        cel.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); alternar(); } });
      }
      cabecalho.append(cel);
    }
  }

  function recalcular() {
    let lista = linhas;
    const col = ordem && colunas.find((c) => c.id === ordem.coluna);
    if (col?.valor) {
      const dir = ordem.direcao === 'desc' ? -1 : 1;
      lista = [...linhas].sort((a, b) => {
        const va = col.valor(a); const vb = col.valor(b);
        if (va == null && vb == null) return 0;
        if (va == null) return 1;
        if (vb == null) return -1;
        return (typeof va === 'string' ? va.localeCompare(vb, 'pt-BR', { numeric: true }) : va - vb) * dir;
      });
    }
    if (o.agrupar) {
      const grupos = new Map();
      for (const l of lista) {
        const g = o.agrupar(l) ?? { chave: '—', rotulo: 'Sem grupo' };
        if (!grupos.has(g.chave)) grupos.set(g.chave, { ...g, linhas: [] });
        grupos.get(g.chave).linhas.push(l);
      }
      itens = [];
      for (const g of [...grupos.values()].sort((a, b) => a.rotulo.localeCompare(b.rotulo, 'pt-BR'))) {
        itens.push({ grupo: g });
        if (!recolhidos.has(g.chave)) itens.push(...g.linhas.map((l) => ({ linha: l })));
      }
    } else {
      itens = lista.map((l) => ({ linha: l }));
    }
    foco = Math.min(foco, Math.max(0, itens.length - 1));
    corpo.style.height = `${itens.length * ALTURA}px`;
    el.setAttribute('aria-rowcount', String(itens.length + 1));
    const vazio = !linhas.length;
    vazioEl.hidden = !vazio;
    rolagem.hidden = vazio;
    if (vazio) vazioEl.replaceChildren(o.vazio?.() ?? h('p', { class: 'vazio', text: 'Nada para mostrar.' }));
    desenharCabecalho();
    desenharRodape();
    desenharVisiveis(true);
  }

  function desenharRodape() {
    const n = linhas.length;
    rodape.replaceChildren(
      h('span', { text: `${n.toLocaleString('pt-BR')} ${n === 1 ? 'linha' : 'linhas'}${sel.size ? ` · ${sel.size.toLocaleString('pt-BR')} selecionada(s)` : ''}` }),
      h('span', { class: 'sutil', text: o.selecionavel ? 'Shift+clique seleciona um intervalo · Espaço marca · Enter abre' : '' }));
  }

  let ultimoInicio = -1;
  let ultimoFim = -1;
  function desenharVisiveis(forcar = false) {
    const topo = rolagem.scrollTop;
    const alturaVisivel = rolagem.clientHeight || 600;
    const inicio = Math.max(0, Math.floor(topo / ALTURA) - SOBRA);
    const fim = Math.min(itens.length, Math.ceil((topo + alturaVisivel) / ALTURA) + SOBRA);
    if (!forcar && inicio === ultimoInicio && fim === ultimoFim) return;
    ultimoInicio = inicio;
    ultimoFim = fim;
    const frag = document.createDocumentFragment();
    for (let i = inicio; i < fim; i++) frag.append(desenharItem(itens[i], i));
    corpo.replaceChildren(frag);
  }

  function desenharItem(item, i) {
    if (item.grupo) {
      const g = item.grupo;
      const aberto = !recolhidos.has(g.chave);
      const el2 = h('div', { class: 'tv-grupo', role: 'row', 'aria-rowindex': i + 2 },
        h('button', { class: 'btn-icone pequeno', 'aria-expanded': String(aberto), 'aria-label': `${aberto ? 'Recolher' : 'Expandir'} ${g.rotulo}`,
          onclick: () => { aberto ? recolhidos.add(g.chave) : recolhidos.delete(g.chave); recalcular(); } }, icone(aberto ? 'chevron-baixo' : 'chevron')),
        g.icone ? icone(g.icone, { tamanho: 14 }) : null,
        h('span', { text: g.rotulo }), h('span', { class: 'tv-grupo-n', text: `${g.linhas.length}` }));
      el2.style.top = `${i * ALTURA}px`;
      return el2;
    }
    const l = item.linha;
    const k = o.chave(l);
    const marcada = sel.has(k);
    const linha = h('div', {
      class: ['tv-linha', marcada && 'selecionada'], role: 'row', 'aria-rowindex': i + 2, 'aria-selected': o.selecionavel ? String(marcada) : null,
      tabindex: i === foco ? 0 : -1, dataset: { i: String(i) },
    });
    linha.style.top = `${i * ALTURA}px`;
    linha.style.gridTemplateColumns = grade();
    if (o.selecionavel) {
      const c = h('input', { type: 'checkbox', class: 'check', checked: marcada, tabindex: -1, 'aria-label': `Selecionar ${l.hostname ?? l.nome ?? k}` });
      c.addEventListener('click', (ev) => { ev.stopPropagation(); alternarLinha(i, ev.shiftKey); });
      linha.append(h('div', { class: 'tv-celula', role: 'gridcell' }, c));
    }
    for (const col of colunas) {
      let conteudo;
      try { conteudo = col.render(l); } catch { conteudo = '—'; }
      linha.append(h('div', { class: ['tv-celula', col.num && 'num', col.classe], role: 'gridcell' }, conteudo ?? '—'));
    }
    linha.addEventListener('click', (ev) => {
      if (ev.target.closest('a, button, input, select')) return;
      if (o.selecionavel && (ev.shiftKey || ev.ctrlKey || ev.metaKey)) { alternarLinha(i, ev.shiftKey); return; }
      focar(i);
      if (o.abrirComClique) o.aoAbrir?.(l);
    });
    linha.addEventListener('dblclick', (ev) => { if (!ev.target.closest('a, button, input')) o.aoAbrir?.(l); });
    return linha;
  }

  function alternarLinha(i, intervalo) {
    const l = itens[i]?.linha;
    if (!l) return;
    if (intervalo && ancoraShift != null) {
      const [a, b] = [Math.min(ancoraShift, i), Math.max(ancoraShift, i)];
      const marcar = !sel.has(o.chave(l));
      for (let j = a; j <= b; j++) if (itens[j]?.linha) (marcar ? sel.add(o.chave(itens[j].linha)) : sel.delete(o.chave(itens[j].linha)));
    } else {
      const k = o.chave(l);
      sel.has(k) ? sel.delete(k) : sel.add(k);
      ancoraShift = i;
    }
    foco = i;
    mudouSelecao();
  }

  function mudouSelecao() {
    desenharCabecalho();
    desenharRodape();
    desenharVisiveis(true);
    o.aoSelecionar?.(new Set(sel));
  }

  function focar(i) {
    foco = Math.max(0, Math.min(itens.length - 1, i));
    const topo = foco * ALTURA;
    if (topo < rolagem.scrollTop + 40) rolagem.scrollTop = topo - 40;
    else if (topo + ALTURA > rolagem.scrollTop + rolagem.clientHeight) rolagem.scrollTop = topo + ALTURA - rolagem.clientHeight;
    desenharVisiveis(true);
    corpo.querySelector(`[data-i="${foco}"]`)?.focus();
  }

  rolagem.addEventListener('scroll', () => requestAnimationFrame(() => desenharVisiveis()), { passive: true });
  corpo.addEventListener('keydown', (ev) => {
    const passos = { ArrowDown: 1, ArrowUp: -1, PageDown: 10, PageUp: -10 };
    if (ev.key in passos) { ev.preventDefault(); focar(foco + passos[ev.key]); }
    else if (ev.key === 'Home') { ev.preventDefault(); focar(0); }
    else if (ev.key === 'End') { ev.preventDefault(); focar(itens.length - 1); }
    else if (ev.key === ' ' && o.selecionavel && ev.target.classList.contains('tv-linha')) { ev.preventDefault(); alternarLinha(foco, ev.shiftKey); }
    else if (ev.key === 'Enter' && ev.target.classList.contains('tv-linha')) { const l = itens[foco]?.linha; if (l) o.aoAbrir?.(l); }
    else if (ev.key === 'a' && (ev.ctrlKey || ev.metaKey) && o.selecionavel) { ev.preventDefault(); linhas.forEach((l) => sel.add(o.chave(l))); mudouSelecao(); }
  });
  if (o.menu) {
    menuContexto(corpo, (ev) => {
      const linhaEl = ev.target.closest('.tv-linha');
      const l = linhaEl && itens[Number(linhaEl.dataset.i)]?.linha;
      if (!l) return null;
      const k = o.chave(l);
      if (o.selecionavel && !sel.has(k)) { sel.clear(); sel.add(k); mudouSelecao(); }
      const selecionadas = o.selecionavel ? linhas.filter((x) => sel.has(o.chave(x))) : [l];
      return o.menu(l, selecionadas);
    });
  }
  new ResizeObserver(() => desenharVisiveis(true)).observe(rolagem);

  return {
    el,
    definirLinhas(novas) {
      linhas = novas;
      // seleção sobrevive a atualizações; some o que não existe mais
      const existentes = new Set(novas.map(o.chave));
      let mudou = false;
      for (const k of [...sel]) if (!existentes.has(k)) { sel.delete(k); mudou = true; }
      recalcular();
      if (mudou) o.aoSelecionar?.(new Set(sel));
    },
    /** Redesenha só as linhas visíveis (atualização ao vivo sem reordenar). */
    atualizarVisiveis() { desenharVisiveis(true); },
    reordenar() { recalcular(); },
    definirColunas(novas) { colunas = novas; recalcular(); },
    definirAgrupamento(fn) { o.agrupar = fn; recalcular(); },
    selecionadas: () => linhas.filter((l) => sel.has(o.chave(l))),
    limparSelecao() { sel.clear(); mudouSelecao(); },
  };
}
