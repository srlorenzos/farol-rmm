// Gráfico de linha em SVG feito à mão: uma série, uma escala (0–100%), crosshair + tooltip,
// navegação por teclado e tabela de dados alternativa.
import { h, s, preencher, fmtHora, fmtData, fmtNum } from './util.js';

const MARGEM = { topo: 12, direita: 12, base: 26, esquerda: 40 };
const ALTURA = 200;

/**
 * @param {object} o
 * @param {string} o.titulo      ex.: 'CPU'
 * @param {Array}  o.pontos      [{ t, [campo]: valor }]
 * @param {string} o.campo       chave do valor
 * @param {number} o.desde       início da janela (ms)
 * @param {number} o.ate         fim da janela (ms)
 * @param {number} o.baldeMs     intervalo entre amostras (para detectar lacunas)
 */
export function graficoLinha({ titulo, pontos, campo, desde, ate, baldeMs }) {
  const dados = pontos.filter((p) => p[campo] != null).map((p) => ({ t: p.t + baldeMs / 2, v: p[campo] }));
  const area = h('div', { class: 'grafico-area' });
  const dica = h('div', { class: 'grafico-dica', role: 'status', 'aria-live': 'polite' });
  const ultimo = dados.at(-1);
  const figura = h('figure', { class: 'grafico' },
    h('figcaption', { class: 'grafico-titulo' },
      h('span', { text: titulo }),
      h('span', { class: 'grafico-atual' }, ultimo ? `${fmtNum(ultimo.v, 0)}% agora` : 'sem dados')),
    area, dica,
    tabela(titulo, dados));

  if (!dados.length) {
    area.append(h('p', { class: 'grafico-vazio muted', text: 'Ainda não há histórico. Os pontos aparecem a cada minuto de check-in.' }));
    return figura;
  }

  let largura = 0;
  const desenhar = () => {
    const w = Math.max(280, Math.floor(area.clientWidth || 600));
    if (w === largura) return;
    largura = w;
    preencher(area, svgGrafico({ titulo, dados, desde, ate, baldeMs, largura: w, dica, area }));
  };
  const obs = new ResizeObserver(desenhar);
  obs.observe(area);
  requestAnimationFrame(desenhar);
  return figura;
}

function svgGrafico({ titulo, dados, desde, ate, baldeMs, largura, dica, area }) {
  const iw = largura - MARGEM.esquerda - MARGEM.direita;
  const ih = ALTURA - MARGEM.topo - MARGEM.base;
  const x = (t) => MARGEM.esquerda + ((t - desde) / (ate - desde)) * iw;
  const y = (v) => MARGEM.topo + ih - (Math.max(0, Math.min(100, v)) / 100) * ih;

  const svg = s('svg', {
    class: 'grafico-svg', viewBox: `0 0 ${largura} ${ALTURA}`, width: largura, height: ALTURA,
    role: 'img', tabindex: 0, 'aria-label': `${titulo} nas últimas ${Math.round((ate - desde) / 3600_000)} horas. Use as setas para percorrer os pontos.`,
  });

  // Grade horizontal (hairline) + rótulos do eixo Y
  for (const v of [0, 25, 50, 75, 100]) {
    svg.append(
      s('line', { class: v === 0 ? 'eixo-base' : 'grade', x1: MARGEM.esquerda, x2: largura - MARGEM.direita, y1: y(v), y2: y(v) }),
      s('text', { class: 'eixo-rotulo', x: MARGEM.esquerda - 8, y: y(v) + 4, 'text-anchor': 'end' }, `${v}%`));
  }
  // Rótulos do eixo X a cada 4 h (ou 1 h em janelas curtas)
  const passoX = (ate - desde) > 6 * 3600_000 ? 4 * 3600_000 : 3600_000;
  for (let t = Math.ceil(desde / passoX) * passoX; t <= ate; t += passoX) {
    const px = x(t);
    if (px < MARGEM.esquerda + 16 || px > largura - MARGEM.direita - 16) continue;
    svg.append(s('text', { class: 'eixo-rotulo', x: px, y: ALTURA - 6, 'text-anchor': 'middle' }, fmtHora(t)));
  }

  // Segmentos contínuos (quebra a linha quando falta amostra — agente offline)
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
      const preench = `${linha}L${x(seg.at(-1).t).toFixed(1)},${y(0)}L${x(seg[0].t).toFixed(1)},${y(0)}Z`;
      svg.append(s('path', { class: 'serie-area', d: preench }));
      svg.append(s('path', { class: 'serie-linha', d: linha }));
    } else {
      svg.append(s('circle', { class: 'serie-ponto', cx: x(seg[0].t), cy: y(seg[0].v), r: 2.5 }));
    }
  }

  // Camada de interação
  const cruz = s('line', { class: 'cruz', y1: MARGEM.topo, y2: MARGEM.topo + ih, visibility: 'hidden' });
  const marca = s('circle', { class: 'cruz-ponto', r: 4.5, visibility: 'hidden' });
  const captura = s('rect', { class: 'captura', x: MARGEM.esquerda, y: 0, width: iw, height: ALTURA, fill: 'transparent' });
  svg.append(cruz, marca, captura);

  let indice = -1;
  const mostrar = (i) => {
    indice = Math.max(0, Math.min(dados.length - 1, i));
    const p = dados[indice];
    const px = x(p.t);
    for (const [k, v] of [['x1', px], ['x2', px]]) cruz.setAttribute(k, v);
    marca.setAttribute('cx', px);
    marca.setAttribute('cy', y(p.v));
    cruz.setAttribute('visibility', 'visible');
    marca.setAttribute('visibility', 'visible');
    preencher(dica, 
      h('strong', { class: 'dica-valor', text: `${fmtNum(p.v, 1)}%` }),
      h('span', { class: 'dica-serie' }, h('span', { class: 'dica-chave', 'aria-hidden': 'true' }), titulo),
      h('span', { class: 'dica-hora', text: fmtData(p.t) }));
    dica.classList.add('visivel');
    const escala = area.clientWidth / largura || 1;
    const larguraDica = dica.offsetWidth || 140;
    let esquerda = px * escala + 12;
    if (esquerda + larguraDica > area.clientWidth) esquerda = px * escala - larguraDica - 12;
    dica.style.left = `${Math.max(0, esquerda)}px`;
    dica.style.top = `${Math.max(0, y(p.v) * escala - 20)}px`;
  };
  const esconder = () => {
    cruz.setAttribute('visibility', 'hidden');
    marca.setAttribute('visibility', 'hidden');
    dica.classList.remove('visivel');
  };
  const maisProximo = (t) => {
    let lo = 0, hi = dados.length - 1;
    while (lo < hi) {
      const m = (lo + hi) >> 1;
      if (dados[m].t < t) lo = m + 1; else hi = m;
    }
    if (lo > 0 && Math.abs(dados[lo - 1].t - t) < Math.abs(dados[lo].t - t)) lo--;
    return lo;
  };
  svg.addEventListener('pointermove', (ev) => {
    const r = svg.getBoundingClientRect();
    const px = ((ev.clientX - r.left) / r.width) * largura;
    const t = desde + ((px - MARGEM.esquerda) / iw) * (ate - desde);
    mostrar(maisProximo(t));
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

function tabela(titulo, dados) {
  const corpo = h('tbody');
  const det = h('details', { class: 'grafico-tabela' }, h('summary', {}, 'Ver dados em tabela'));
  det.addEventListener('toggle', () => {
    if (!det.open || corpo.childElementCount) return;
    for (const p of [...dados].reverse()) corpo.append(h('tr', {}, h('td', { text: fmtData(p.t) }), h('td', { class: 'num', text: `${fmtNum(p.v, 1)}%` })));
  }, { once: false });
  det.append(h('div', { class: 'tabela-rolagem' },
    h('table', { class: 'tabela tabela-compacta' },
      h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, 'Horário'), h('th', { scope: 'col', class: 'num' }, titulo))), corpo)));
  return det;
}
