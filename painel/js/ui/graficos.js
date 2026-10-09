// Gráficos em SVG/HTML feitos à mão, seguindo as regras do dataviz:
// uma escala só, linhas de 2px, área com lavagem de ~10%, grade hairline recessiva, texto sempre em tokens de texto,
// dica (tooltip) no hover e no teclado, tabela de dados alternativa, legenda quando há 2+ séries.
import { h, s, preencher } from '../nucleo/dom.js';
import { fmtHora, fmtData, fmtNum, fmtDia, fmtInt } from '../nucleo/formato.js';

const MARGEM = { topo: 14, direita: 14, base: 26, esquerda: 40 };
const ALTURA = 210;

/**
 * Linha temporal 0–100% (CPU, RAM, disco). Uma série por gráfico — o título nomeia a série, sem legenda.
 * graficoLinha({ titulo, pontos: [{t, cpu}], campo: 'cpu', desde, ate, baldeMs, limite?: 90 })
 */
export function graficoLinha({ titulo, pontos, campo, desde, ate, baldeMs, limite, unidade = '%' }) {
  const dados = pontos.filter((p) => p[campo] != null).map((p) => ({ t: p.t + baldeMs / 2, v: p[campo] }));
  const area = h('div', { class: 'grafico-area' });
  const dica = h('div', { class: 'grafico-dica', role: 'status', 'aria-live': 'polite' });
  const ultimo = dados.at(-1);
  const max = dados.length ? Math.max(...dados.map((d) => d.v)) : null;
  const media = dados.length ? dados.reduce((n, d) => n + d.v, 0) / dados.length : null;
  const figura = h('figure', { class: 'grafico' },
    h('figcaption', { class: 'linha-entre mb-3' },
      h('span', { class: 'forte', text: titulo }),
      h('span', { class: 'linha gap-4 pequeno sutil' },
        h('span', {}, 'Agora ', h('strong', { class: 'tabular', estilo: { color: 'var(--texto-1)' }, text: ultimo ? `${fmtNum(ultimo.v, 0)}${unidade}` : '—' })),
        h('span', {}, 'Média ', h('strong', { class: 'tabular', estilo: { color: 'var(--texto-1)' }, text: media != null ? `${fmtNum(media, 0)}${unidade}` : '—' })),
        h('span', {}, 'Pico ', h('strong', { class: 'tabular', estilo: { color: 'var(--texto-1)' }, text: max != null ? `${fmtNum(max, 0)}${unidade}` : '—' })))),
    area, dica, tabelaDados(titulo, dados, unidade));

  if (!dados.length) {
    area.append(h('p', { class: 'grafico-vazio', text: 'Ainda não há histórico. Os pontos aparecem a cada minuto de check-in.' }));
    return figura;
  }
  let largura = 0;
  const desenhar = () => {
    const w = Math.max(260, Math.floor(area.clientWidth || 600));
    if (w === largura) return;
    largura = w;
    preencher(area, svgLinha({ titulo, dados, desde, ate, baldeMs, largura: w, dica, area, limite, unidade }));
  };
  new ResizeObserver(desenhar).observe(area);
  requestAnimationFrame(desenhar);
  return figura;
}

function svgLinha({ titulo, dados, desde, ate, baldeMs, largura, dica, area, limite, unidade }) {
  const iw = largura - MARGEM.esquerda - MARGEM.direita;
  const ih = ALTURA - MARGEM.topo - MARGEM.base;
  const x = (t) => MARGEM.esquerda + ((t - desde) / (ate - desde)) * iw;
  const y = (v) => MARGEM.topo + ih - (Math.max(0, Math.min(100, v)) / 100) * ih;
  const horas = Math.round((ate - desde) / 3600_000);
  const svg = s('svg', {
    class: 'grafico-svg', viewBox: `0 0 ${largura} ${ALTURA}`, width: largura, height: ALTURA,
    role: 'img', tabindex: 0, 'aria-label': `${titulo} nas últimas ${horas} horas. Use as setas para percorrer os pontos.`,
  });
  for (const v of [0, 25, 50, 75, 100]) {
    svg.append(
      s('line', { class: v === 0 ? 'eixo-base' : 'grade-linha', x1: MARGEM.esquerda, x2: largura - MARGEM.direita, y1: y(v), y2: y(v) }),
      s('text', { class: 'eixo-rotulo', x: MARGEM.esquerda - 8, y: y(v) + 4, 'text-anchor': 'end' }, `${v}${unidade}`));
  }
  const janela = ate - desde;
  const passoX = janela > 48 * 3600_000 ? 24 * 3600_000 : janela > 6 * 3600_000 ? 4 * 3600_000 : janela > 2 * 3600_000 ? 3600_000 : 15 * 60_000;
  const fuso = new Date().getTimezoneOffset() * 60_000;
  for (let t = Math.ceil((desde - fuso) / passoX) * passoX + fuso; t <= ate; t += passoX) {
    const px = x(t);
    if (px < MARGEM.esquerda + 18 || px > largura - MARGEM.direita - 18) continue;
    svg.append(s('text', { class: 'eixo-rotulo', x: px, y: ALTURA - 6, 'text-anchor': 'middle' }, passoX >= 86400_000 ? fmtDia(t) : fmtHora(t)));
  }
  if (limite != null) {
    svg.append(s('line', { class: 'limite', x1: MARGEM.esquerda, x2: largura - MARGEM.direita, y1: y(limite), y2: y(limite) }),
      s('text', { class: 'limite-rotulo', x: largura - MARGEM.direita, y: y(limite) - 4, 'text-anchor': 'end' }, `limite ${limite}${unidade}`));
  }
  // segmentos contínuos: a linha quebra quando falta amostra (dispositivo offline)
  const segmentos = [];
  let atual = [];
  for (const p of dados) {
    if (atual.length && p.t - atual.at(-1).t > baldeMs * 2.5) { segmentos.push(atual); atual = []; }
    atual.push(p);
  }
  if (atual.length) segmentos.push(atual);
  for (const seg of segmentos) {
    const linha = seg.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join('');
    if (seg.length > 1) {
      svg.append(s('path', { class: 'serie-area', d: `${linha}L${x(seg.at(-1).t).toFixed(1)},${y(0)}L${x(seg[0].t).toFixed(1)},${y(0)}Z` }));
      svg.append(s('path', { class: 'serie-linha', d: linha }));
    } else {
      svg.append(s('circle', { class: 'serie-ponto', cx: x(seg[0].t), cy: y(seg[0].v), r: 4 }));
    }
  }
  const fim = dados.at(-1);
  svg.append(s('circle', { class: 'serie-ponto', cx: x(fim.t), cy: y(fim.v), r: 4 }));

  const cruz = s('line', { class: 'cruz', y1: MARGEM.topo, y2: MARGEM.topo + ih, visibility: 'hidden' });
  const marca = s('circle', { class: 'cruz-ponto', r: 5, visibility: 'hidden' });
  svg.append(cruz, marca, s('rect', { x: MARGEM.esquerda, y: 0, width: iw, height: ALTURA, fill: 'transparent' }));

  let indice = -1;
  const mostrar = (i) => {
    indice = Math.max(0, Math.min(dados.length - 1, i));
    const p = dados[indice];
    const px = x(p.t);
    cruz.setAttribute('x1', px); cruz.setAttribute('x2', px);
    marca.setAttribute('cx', px); marca.setAttribute('cy', y(p.v));
    cruz.setAttribute('visibility', 'visible'); marca.setAttribute('visibility', 'visible');
    preencher(dica, h('strong', { text: `${fmtNum(p.v, 1)}${unidade}` }), h('span', { text: `${titulo} · ${fmtData(p.t)}` }));
    dica.classList.add('visivel');
    const escala = area.clientWidth / largura || 1;
    const ld = dica.offsetWidth || 140;
    let esq = px * escala + 14;
    if (esq + ld > area.clientWidth) esq = px * escala - ld - 14;
    dica.style.left = `${Math.max(0, esq)}px`;
    dica.style.top = `${Math.max(0, y(p.v) * escala - 26)}px`;
  };
  const esconder = () => { cruz.setAttribute('visibility', 'hidden'); marca.setAttribute('visibility', 'hidden'); dica.classList.remove('visivel'); };
  const maisProximo = (t) => {
    let lo = 0; let hi = dados.length - 1;
    while (lo < hi) { const m = (lo + hi) >> 1; if (dados[m].t < t) lo = m + 1; else hi = m; }
    if (lo > 0 && Math.abs(dados[lo - 1].t - t) < Math.abs(dados[lo].t - t)) lo--;
    return lo;
  };
  svg.addEventListener('pointermove', (ev) => {
    const r = svg.getBoundingClientRect();
    const px = ((ev.clientX - r.left) / r.width) * largura;
    mostrar(maisProximo(desde + ((px - MARGEM.esquerda) / iw) * (ate - desde)));
  });
  svg.addEventListener('pointerleave', esconder);
  svg.addEventListener('blur', esconder);
  svg.addEventListener('focus', () => mostrar(indice < 0 ? dados.length - 1 : indice));
  svg.addEventListener('keydown', (ev) => {
    const passos = { ArrowLeft: -1, ArrowRight: 1, PageUp: -12, PageDown: 12 };
    if (ev.key in passos) { ev.preventDefault(); mostrar((indice < 0 ? dados.length - 1 : indice) + passos[ev.key]); }
    else if (ev.key === 'Home') { ev.preventDefault(); mostrar(0); }
    else if (ev.key === 'End') { ev.preventDefault(); mostrar(dados.length - 1); }
    else if (ev.key === 'Escape') esconder();
  });
  return svg;
}

function tabelaDados(titulo, dados, unidade) {
  const corpo = h('tbody');
  const det = h('details', { class: 'grafico-tabela' }, h('summary', {}, 'Ver dados em tabela'));
  det.addEventListener('toggle', () => {
    if (!det.open || corpo.childElementCount) return;
    for (const p of [...dados].reverse()) corpo.append(h('tr', {}, h('td', { text: fmtData(p.t) }), h('td', { class: 'num', text: `${fmtNum(p.v, 1)}${unidade}` })));
  });
  det.append(h('div', { class: 'tabela-caixa' }, h('table', { class: 'tabela tabela-compacta' },
    h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, 'Horário'), h('th', { scope: 'col', class: 'num' }, titulo))), corpo)));
  return det;
}

/**
 * Barras horizontais rotuladas (magnitude por categoria, uma cor só — a da série 1).
 * barras([{ rotulo, valor, icone?: Node, href? }], { formato })
 */
export function barras(itens, { formato = fmtInt, max } = {}) {
  const topo = max ?? Math.max(1, ...itens.map((i) => i.valor));
  return h('div', { class: 'barras', role: 'list' }, itens.map((it) => {
    const v = h('span', { class: 'barra-valor' });
    v.style.width = `${(it.valor / topo) * 100}%`;
    const rot = h('span', { class: 'barra-rotulo' }, it.icone ?? null, h('span', { text: it.rotulo }));
    return h('div', { class: 'barra-linha', role: 'listitem', 'data-dica': `${it.rotulo}: ${formato(it.valor)}` },
      it.href ? h('a', { href: it.href, class: 'barra-rotulo' }, it.icone ?? null, h('span', { text: it.rotulo })) : rot,
      h('span', { class: 'barra-trilho' }, v),
      h('span', { class: 'barra-numero', text: formato(it.valor) }));
  }));
}

/**
 * Composição (partes de um todo) numa barra empilhada de 100% + legenda com contagens.
 * Cores de estado (ok/aviso/critico/neutro/info) — sempre acompanhadas de rótulo na legenda.
 * composicao([{ rotulo, valor, cor: 'ok', href? }], { rotulo })
 */
export function composicao(partes, { rotulo = 'Composição', vertical = false } = {}) {
  const total = partes.reduce((n, p) => n + p.valor, 0);
  const barra = h('div', { class: 'empilhada', role: 'img', 'aria-label': `${rotulo}: ${partes.map((p) => `${p.rotulo} ${p.valor}`).join(', ')}` });
  for (const p of partes) {
    if (!p.valor) continue;
    const seg = h('span', { class: `cor-${p.cor}`, 'data-dica': `${p.rotulo}: ${fmtInt(p.valor)} (${Math.round((p.valor / total) * 100)}%)` });
    seg.style.flexGrow = String(p.valor);
    barra.append(seg);
  }
  const legenda = h('div', { class: ['legenda', vertical && 'legenda-vertical'] }, partes.map((p) => {
    const conteudo = [h('span', { class: 'linha gap-1' }, h('span', { class: `chave cor-${p.cor}`, 'aria-hidden': 'true' }), h('span', { text: ` ${p.rotulo}` })),
      h('strong', { text: fmtInt(p.valor) })];
    return p.href ? h('a', { class: 'legenda-item', href: p.href }, conteudo) : h('span', { class: 'legenda-item' }, conteudo);
  }));
  return h('div', {}, total ? barra : h('div', { class: 'empilhada' }), legenda);
}
