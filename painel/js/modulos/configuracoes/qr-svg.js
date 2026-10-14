// Desenha o QR Code (gerado por qr-encode.js) como SVG puro — sem <canvas>, sem imagem, sem round-trip
// ao servidor: a URI otpauth:// nunca sai do navegador. Preto sobre branco sempre, com zona de silêncio
// clara ao redor (exigida pelo padrão) — nunca as cores do tema, nem no modo escuro, porque um leitor
// de QR real precisa desse contraste fixo pra funcionar.
import { s } from '../../nucleo/dom.js';
import { gerarMatrizQR } from './qr-encode.js';

/**
 * qrCodeSvg('otpauth://...', { tamanhoPx: 200 }) → <svg> pronto para anexar ao DOM.
 * Agrupa módulos escuros contíguos de cada linha num único <rect> (bem menos elementos que um por módulo).
 */
export function qrCodeSvg(texto, { tamanhoPx = 200, margemModulos = 4, nivel = 'M' } = {}) {
  const { tamanho, modulos } = gerarMatrizQR(texto, { nivel });
  const lado = tamanho + margemModulos * 2;

  const barras = [];
  for (let r = 0; r < tamanho; r++) {
    let c = 0;
    while (c < tamanho) {
      if (!modulos[r][c]) { c++; continue; }
      const inicio = c;
      while (c < tamanho && modulos[r][c]) c++;
      barras.push(s('rect', { x: inicio + margemModulos, y: r + margemModulos, width: c - inicio, height: 1, fill: '#000' }));
    }
  }

  return s('svg', {
    class: 'qr-code', viewBox: `0 0 ${lado} ${lado}`, width: tamanhoPx, height: tamanhoPx,
    role: 'img', 'aria-label': 'QR Code para configurar o aplicativo autenticador 2FA',
    'shape-rendering': 'crispEdges',
  }, s('rect', { x: 0, y: 0, width: lado, height: lado, fill: '#fff' }), ...barras);
}
