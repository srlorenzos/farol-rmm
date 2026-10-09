// Ícones próprios do Farol: grade 24×24, traço 1.75, pontas e junções arredondadas.
// Cada ícone é uma lista de paths (string) ou elementos { c: [cx, cy, r] } para círculos.
import { s } from './dom.js';

const I = {
  painel: ['M4 13h6V4H4z', 'M14 20h6v-9h-6z', 'M4 20h6v-3H4z', 'M14 7h6V4h-6z'],
  dispositivos: ['M3.5 5.5h17v10.5h-17z', 'M9 20h6', 'M12 16v4'],
  notebook: ['M5 6h14v9H5z', 'M3 18h18'],
  servidor: ['M4.5 4.5h15v6h-15z', 'M4.5 13.5h15v6h-15z', 'M8 7.5h.01', 'M8 16.5h.01'],
  scripts: ['M4 5h16v14H4z', 'M8 10l2.5 2L8 14', 'M13 14h3'],
  biblioteca: ['M5 4h3v16H5z', 'M10 4h3v16h-3z', 'M15.2 4.6l2.9-.8 3.6 15.4-2.9.8z'],
  execucoes: ['M8 6l10 6-10 6z', 'M4 5v14'],
  alertas: ['M6 16v-5a6 6 0 0112 0v5l1.5 2h-15z', 'M10 20.5a2 2 0 004 0'],
  auditoria: ['M12 3l7.5 3v5.5c0 4.5-3.2 8-7.5 9.5-4.3-1.5-7.5-5-7.5-9.5V6z', 'M9 12l2 2 4-4'],
  config: ['M12 9.2a2.8 2.8 0 100 5.6 2.8 2.8 0 000-5.6z', 'M19.4 13.5a7.6 7.6 0 000-3l2-1.6-2-3.4-2.4 1a7.4 7.4 0 00-2.6-1.5L14 2.5h-4l-.4 2.5A7.4 7.4 0 007 6.5l-2.4-1-2 3.4 2 1.6a7.6 7.6 0 000 3l-2 1.6 2 3.4 2.4-1a7.4 7.4 0 002.6 1.5l.4 2.5h4l.4-2.5a7.4 7.4 0 002.6-1.5l2.4 1 2-3.4z'],
  usuarios: ['M9 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7z', 'M2.5 20c.6-3.4 3.2-5.5 6.5-5.5s5.9 2.1 6.5 5.5', 'M16 4.3a3.5 3.5 0 010 6.4', 'M18 14.8c1.9.7 3.2 2.5 3.5 5.2'],
  usuario: ['M12 11a4 4 0 100-8 4 4 0 000 8z', 'M4 21c.8-4 4-6.5 8-6.5s7.2 2.5 8 6.5'],
  predio: ['M4 21V5l8-2v18', 'M12 8h8v13', 'M2.5 21h19', 'M7.5 8h1', 'M7.5 12h1', 'M7.5 16h1', 'M15.5 12h1', 'M15.5 16h1'],
  site: ['M12 21s-7-6.2-7-11.5a7 7 0 0114 0C19 14.8 12 21 12 21z', 'M12 12a2.5 2.5 0 100-5 2.5 2.5 0 000 5z'],
  busca: ['M10.5 4a6.5 6.5 0 100 13 6.5 6.5 0 000-13z', 'M20 20l-4.6-4.6'],
  sol: ['M12 8a4 4 0 100 8 4 4 0 000-8z', 'M12 2v2', 'M12 20v2', 'M4.9 4.9l1.4 1.4', 'M17.7 17.7l1.4 1.4', 'M2 12h2', 'M20 12h2', 'M4.9 19.1l1.4-1.4', 'M17.7 6.3l1.4-1.4'],
  lua: ['M20 14.5A8 8 0 019.5 4 8 8 0 1020 14.5z'],
  sair: ['M15 4h4v16h-4', 'M10 8l-4 4 4 4', 'M6 12h10'],
  menu: ['M4 6h16', 'M4 12h16', 'M4 18h16'],
  recolher: ['M11 6l-6 6 6 6', 'M19 6l-6 6 6 6'],
  mais: ['M12 5v14', 'M5 12h14'],
  lixo: ['M4 7h16', 'M10 11v6', 'M14 11v6', 'M6 7l1 13h10l1-13', 'M9 7V4h6v3'],
  copiar: ['M9 9h11v11H9z', 'M5 15H4V4h11v1'],
  fechar: ['M6 6l12 12', 'M18 6L6 18'],
  check: ['M5 12.5l4.5 4.5L19 7'],
  terminal: ['M3.5 4.5h17v15h-17z', 'M7 9l3 3-3 3', 'M12.5 15H17'],
  tela: ['M3.5 4.5h17v11h-17z', 'M9 20h6', 'M12 15.5V20', 'M10 8l4.5 2.5-2 .5-.5 2z'],
  energia: ['M12 3v8', 'M6.3 6.8a8 8 0 1011.4 0'],
  reiniciar: ['M20 11a8 8 0 10-2.3 5.7', 'M20 5v6h-6'],
  atualizar: ['M20 11a8 8 0 10-2.3 5.7', 'M20 5v6h-6'],
  play: ['M7 5l12 7-12 7z'],
  chave: ['M14.5 9.5a4 4 0 10-3.4 3.9L9 15.5H7v2H5v2H3v-3l6.6-6.6', 'M15.5 7.5h.01'],
  voltar: ['M15 6l-6 6 6 6'],
  chevron: ['M9 6l6 6-6 6'],
  'chevron-baixo': ['M6 9l6 6 6-6'],
  seta: ['M5 12h14', 'M13 6l6 6-6 6'],
  revogar: ['M12 3a9 9 0 100 18 9 9 0 000-18z', 'M5.6 5.6l12.8 12.8'],
  editar: ['M4 20h4L19 9l-4-4L4 16z', 'M13 7l4 4'],
  info: ['M12 3a9 9 0 100 18 9 9 0 000-18z', 'M12 11v6', 'M12 7.5h.01'],
  aviso: ['M12 3.5L21.5 20h-19z', 'M12 10v4.5', 'M12 17.5h.01'],
  critico: ['M8.2 3h7.6L21 8.2v7.6L15.8 21H8.2L3 15.8V8.2z', 'M12 8v5', 'M12 16h.01'],
  ok: ['M12 3a9 9 0 100 18 9 9 0 000-18z', 'M8 12.5l2.7 2.7L16 10'],
  filtro: ['M4 5h16l-6 7.5V19l-4-2v-4.5z'],
  colunas: ['M4 4.5h16v15H4z', 'M9.5 4.5v15', 'M14.5 4.5v15'],
  reticencias: ['M5 12h.01', 'M12 12h.01', 'M19 12h.01'],
  'reticencias-v': ['M12 5h.01', 'M12 12h.01', 'M12 19h.01'],
  download: ['M12 4v11', 'M7 10l5 5 5-5', 'M5 20h14'],
  upload: ['M12 16V5', 'M7 10l5-5 5 5', 'M5 20h14'],
  windows: ['M4 5.5l7-1v7H4z', 'M13 4.2l7-1v8.3h-7z', 'M4 13.5h7v7l-7-1z', 'M13 13.5h7v8.3l-7-1z'],
  linux: ['M12 3c-2.2 0-3.5 1.9-3.5 4.6 0 1.7-.6 2.6-1.6 4.2C5.8 13.6 5 15 5 16.7 5 19.2 7.6 21 12 21s7-1.8 7-4.3c0-1.7-.8-3.1-1.9-4.9-1-1.6-1.6-2.5-1.6-4.2C15.5 4.9 14.2 3 12 3z', 'M10.5 8h.01', 'M13.5 8h.01', 'M10.5 10.5c.9.7 2.1.7 3 0'],
  apple: ['M16.4 12.6c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.1-2.8.9-3.5.9s-1.9-.9-3.1-.8c-1.6 0-3.1.9-3.9 2.4-1.7 2.9-.4 7.2 1.2 9.6.8 1.2 1.7 2.4 3 2.4 1.2 0 1.6-.8 3.1-.8s1.8.8 3.1.8c1.3 0 2.1-1.2 2.9-2.3.9-1.3 1.3-2.6 1.3-2.7-.1 0-2.7-1-2.7-4.2z', 'M14.3 5.3c.6-.8 1.1-1.9 1-3-1 0-2.1.7-2.8 1.5-.6.7-1.1 1.8-1 2.9 1 .1 2.1-.6 2.8-1.4z'],
  cpu: ['M7 7h10v10H7z', 'M10 10h4v4h-4z', 'M10 3v4', 'M14 3v4', 'M10 17v4', 'M14 17v4', 'M3 10h4', 'M3 14h4', 'M17 10h4', 'M17 14h4'],
  memoria: ['M3 8h18v8H3z', 'M7 8v8', 'M11 8v8', 'M15 8v8', 'M5 16v3', 'M19 16v3'],
  disco: ['M12 4c4.4 0 8 1.3 8 3s-3.6 3-8 3-8-1.3-8-3 3.6-3 8-3z', 'M4 7v10c0 1.7 3.6 3 8 3s8-1.3 8-3V7', 'M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3'],
  rede: ['M12 3a9 9 0 100 18 9 9 0 000-18z', 'M3 12h18', 'M12 3c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-5.5-3.5-9s1-6.5 3.5-9z'],
  relogio: ['M12 3a9 9 0 100 18 9 9 0 000-18z', 'M12 7v5l3 2'],
  raio: ['M13 3L5 13.5h6L10 21l8-10.5h-6z'],
  pacote: ['M12 3l8 4.5v9L12 21l-8-4.5v-9z', 'M4 7.5l8 4.5 8-4.5', 'M12 12v9'],
  lista: ['M9 6h11', 'M9 12h11', 'M9 18h11', 'M4.5 6h.01', 'M4.5 12h.01', 'M4.5 18h.01'],
  codigo: ['M8.5 8L4.5 12l4 4', 'M15.5 8l4 4-4 4', 'M13.5 5l-3 14'],
  pulso: ['M3 12h4l2.5-6 5 12 2.5-6H21'],
  tag: ['M3.5 12.5l8-8h8v8l-8 8z', 'M15.5 8.5h.01'],
  olho: ['M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z', 'M12 9.5a2.5 2.5 0 100 5 2.5 2.5 0 000-5z'],
  link: ['M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1', 'M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1'],
  mover: ['M4 12h16', 'M16 8l4 4-4 4', 'M8 4L4 8l4 4'],
  grupo: ['M4 4h7v7H4z', 'M13 4h7v7h-7z', 'M4 13h7v7H4z', 'M13 13h7v7h-7z'],
  estrela: ['M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z'],
  escudo: ['M12 3l7.5 3v5.5c0 4.5-3.2 8-7.5 9.5-4.3-1.5-7.5-5-7.5-9.5V6z'],
  cadeado: ['M6 11h12v9H6z', 'M8.5 11V8a3.5 3.5 0 017 0v3'],
  globo: ['M12 3a9 9 0 100 18 9 9 0 000-18z', 'M3.5 9h17', 'M3.5 15h17', 'M12 3c2.3 2.6 3.4 5.6 3.4 9s-1.1 6.4-3.4 9c-2.3-2.6-3.4-5.6-3.4-9S9.7 5.6 12 3z'],
  importar: ['M12 3v12', 'M7 10l5 5 5-5', 'M4 15v5h16v-5'],
  paleta: ['M12 3a9 9 0 000 18c1 0 1.5-.7 1.5-1.5 0-1.2-1-1.5-1-2.5s.8-1.5 2-1.5h2A4.5 4.5 0 0021 11c0-4.4-4-8-9-8z', 'M7.5 11.5h.01', 'M10 7.5h.01', 'M14.5 7.5h.01'],
  farol: ['M9.6 21l1-10.5h2.8l1 10.5z', 'M9.2 10.5h5.6', 'M10.3 5h3.4v5.5h-3.4z', 'M12 2.5V5', 'M6 21h12', 'M3 5.5l5.5 1.7', 'M21 5.5l-5.5 1.7', 'M3 10l5.5-1.2', 'M21 10l-5.5-1.2'],
};

export const NOMES_ICONES = Object.keys(I);

/** icone('alertas', { tamanho: 16, rotulo: 'Alertas' }) — sem rótulo é decorativo (aria-hidden). */
export function icone(nome, { tamanho, rotulo, classe } = {}) {
  const svg = s('svg', {
    viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
    'stroke-width': 1.75, 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
    class: ['icone', classe],
    ...(tamanho ? { width: tamanho, height: tamanho } : {}),
    ...(rotulo ? { role: 'img', 'aria-label': rotulo } : { 'aria-hidden': 'true', focusable: 'false' }),
  });
  if (tamanho) svg.style.setProperty('--tam-icone', `${tamanho}px`);
  for (const d of I[nome] || I.info) svg.append(s('path', { d }));
  return svg;
}

/** Logotipo do Farol: torre com facho de luz. */
export function logo() {
  const svg = s('svg', { viewBox: '0 0 40 40', class: 'logo', 'aria-hidden': 'true', focusable: 'false' });
  svg.append(
    s('defs', {}, s('linearGradient', { id: 'logo-facho', x1: '0', x2: '1', y1: '0', y2: '0' },
      s('stop', { offset: '0', 'stop-color': 'currentColor', 'stop-opacity': '0.55' }),
      s('stop', { offset: '1', 'stop-color': 'currentColor', 'stop-opacity': '0' }))),
    s('rect', { x: 0.5, y: 0.5, width: 39, height: 39, rx: 11, fill: '#0f2a33', stroke: 'rgba(255,255,255,.08)' }),
    s('path', { d: 'M20 12.5L38 7v13z', fill: 'url(#logo-facho)' }),
    s('path', { d: 'M17.2 32l1.3-14h3l1.3 14z', fill: 'currentColor' }),
    s('path', { d: 'M17.5 13h5v4.5h-5z', fill: '#ffd8a3' }),
    s('path', { d: 'M16.5 17.5h7', stroke: 'currentColor', 'stroke-width': 1.6, 'stroke-linecap': 'round' }),
    s('path', { d: 'M20 10v3', stroke: 'currentColor', 'stroke-width': 1.6, 'stroke-linecap': 'round' }),
    s('path', { d: 'M12.5 32h15', stroke: 'rgba(255,255,255,.35)', 'stroke-width': 1.6, 'stroke-linecap': 'round' }),
  );
  return svg;
}

/** Ícone do sistema operacional (Windows/Linux/macOS). */
export function iconeSo(so) {
  const t = String(so ?? '').toLowerCase();
  const tipo = t.startsWith('win') ? 'windows' : t === 'darwin' || t.startsWith('mac') ? 'macos' : t ? 'linux' : null;
  const el = document.createElement('span');
  el.className = `icone-so ${tipo ?? ''}`;
  el.title = tipo === 'windows' ? 'Windows' : tipo === 'macos' ? 'macOS' : tipo === 'linux' ? 'Linux' : 'Desconhecido';
  el.append(icone(tipo === 'windows' ? 'windows' : tipo === 'macos' ? 'apple' : tipo === 'linux' ? 'linux' : 'dispositivos'));
  return el;
}
