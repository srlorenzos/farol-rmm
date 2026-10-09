// Ilustrações dos estados vazios: SVG simples, traço único, com o facho âmbar do Farol.
import { s } from '../nucleo/dom.js';

function base() {
  return s('svg', { viewBox: '0 0 132 96', class: 'ilustracao', 'aria-hidden': 'true', focusable: 'false' });
}

const DESENHOS = {
  // farol com facho: "nada aqui ainda"
  farol: (svg) => svg.append(
    s('path', { class: 'il-facho', d: 'M66 30 L128 12 L128 52 Z' }),
    s('path', { class: 'il-facho', d: 'M66 30 L4 14 L4 46 Z' }),
    s('path', { class: 'il-fundo', d: 'M58 84 L61 40 H71 L74 84 Z' }),
    s('path', { class: 'il-traco', d: 'M58 84 L61 40 H71 L74 84 Z' }),
    s('path', { class: 'il-traco', d: 'M59.5 62 H72.5' }),
    s('rect', { class: 'il-marca', x: 61.5, y: 26, width: 9, height: 10, rx: 1.5 }),
    s('path', { class: 'il-traco', d: 'M58 40 H74 M60 26 H72 M66 19 V26' }),
    s('path', { class: 'il-chao', d: 'M30 84 H102' }),
  ),
  // lupa: "nenhum resultado"
  busca: (svg) => svg.append(
    s('circle', { class: 'il-fundo', cx: 58, cy: 44, r: 24 }),
    s('circle', { class: 'il-traco', cx: 58, cy: 44, r: 24 }),
    s('path', { class: 'il-traco', d: 'M75 61 L94 80' }),
    s('path', { class: 'il-traco', d: 'M48 40 h20 M48 48 h12' }),
    s('circle', { class: 'il-marca', cx: 98, cy: 24, r: 4 }),
    s('path', { class: 'il-chao', d: 'M30 88 H102' }),
  ),
  // selo de ok: "tudo tranquilo"
  'tudo-ok': (svg) => svg.append(
    s('circle', { class: 'il-facho', cx: 66, cy: 46, r: 38 }),
    s('circle', { class: 'il-fundo', cx: 66, cy: 46, r: 24 }),
    s('circle', { class: 'il-traco', cx: 66, cy: 46, r: 24 }),
    s('path', { class: 'il-traco', d: 'M55 46 l8 8 l14 -15' }),
    s('path', { class: 'il-chao', d: 'M34 88 H98' }),
  ),
  // caixa: "lista vazia"
  caixa: (svg) => svg.append(
    s('path', { class: 'il-fundo', d: 'M30 44 L66 30 L102 44 V74 L66 88 L30 74 Z' }),
    s('path', { class: 'il-traco', d: 'M30 44 L66 30 L102 44 V74 L66 88 L30 74 Z M30 44 L66 58 L102 44 M66 58 V88' }),
    s('path', { class: 'il-facho', d: 'M66 30 L44 8 L88 8 Z' }),
    s('circle', { class: 'il-marca', cx: 66, cy: 20, r: 3 }),
  ),
  // nuvem cortada: "erro de conexão"
  erro: (svg) => svg.append(
    s('path', { class: 'il-fundo', d: 'M40 66 a16 16 0 0 1 4 -31 a22 22 0 0 1 42 -4 a15 15 0 0 1 6 35 Z' }),
    s('path', { class: 'il-traco', d: 'M40 66 a16 16 0 0 1 4 -31 a22 22 0 0 1 42 -4 a15 15 0 0 1 6 35 Z' }),
    s('path', { class: 'il-traco', d: 'M58 44 l16 16 M74 44 l-16 16' }),
    s('path', { class: 'il-chao', d: 'M34 86 H98' }),
  ),
};

export function ilustracao(nome = 'farol') {
  const svg = base();
  (DESENHOS[nome] ?? DESENHOS.farol)(svg);
  return svg;
}
