// Gerador de QR Code em JavaScript puro (sem dependências), seguindo a ISO/IEC 18004: modo byte,
// Reed-Solomon sobre GF(256), padrões de busca/temporização/alinhamento, informação de formato/versão
// e as 8 máscaras com a pontuação de penalidade padrão. Nada sai do navegador/servidor: a URI otpauth://
// nunca é enviada a um serviço externo para "desenhar" o QR.
//
// Sem dependência de DOM — dá para usar tanto aqui no painel (ver qr-svg.js) quanto num teste Node
// (servidor/test/qr-encode.test.js importa este arquivo direto pelo caminho relativo).
//
// Referência normativa usada para validar os números abaixo (tabelas de codewords, polinômios
// geradores, posições de alinhamento): ISO/IEC 18004. Os números são os exigidos pelo padrão —
// qualquer leitor de QR do mercado espera exatamente estas tabelas.

// ---------------------------------------------------------------- Corpo finito GF(256)
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
(function iniciarCampo() {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d; // polinômio primitivo do GF(256) usado pelo QR: x^8+x^4+x^3+x^2+1
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
})();
const gfMul = (a, b) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);

function polyMul(p1, p2) {
  const r = new Uint8Array(p1.length + p2.length - 1);
  for (let i = 0; i < p1.length; i++) for (let j = 0; j < p2.length; j++) r[i + j] ^= gfMul(p1[i], p2[j]);
  return r;
}

function polyMod(dividendo, divisor) {
  let resto = Uint8Array.from(dividendo);
  while (resto.length >= divisor.length) {
    const coef = resto[0];
    if (coef !== 0) for (let i = 0; i < divisor.length; i++) resto[i] ^= gfMul(divisor[i], coef);
    let corte = 0;
    while (corte < resto.length && resto[corte] === 0) corte++;
    resto = resto.slice(corte);
  }
  return resto;
}

/** Polinômio gerador de Reed-Solomon de grau `grau` (produto de (x - α^i), i = 0..grau-1). */
function polinomioGerador(grau) {
  let p = new Uint8Array([1]);
  for (let i = 0; i < grau; i++) p = polyMul(p, new Uint8Array([1, EXP[i]]));
  return p;
}

/** Codewords de correção de erro para um bloco de dados, com um polinômio gerador já calculado. */
function codigosEc(dados, gerador, grau) {
  const dividendo = new Uint8Array(dados.length + grau);
  dividendo.set(dados);
  const resto = polyMod(dividendo, gerador);
  const saida = new Uint8Array(grau);
  saida.set(resto, grau - resto.length);
  return saida;
}

// ---------------------------------------------------------------- Tabelas da ISO/IEC 18004
// Total de codewords (dados + correção) por versão (índice 0 não usado).
const TOTAL_CODEWORDS = [
  0, 26, 44, 70, 100, 134, 172, 196, 242, 292, 346,
  404, 466, 532, 581, 655, 733, 815, 901, 991, 1085,
  1156, 1258, 1364, 1474, 1588, 1706, 1828, 1921, 2051, 2185,
  2323, 2465, 2611, 2761, 2876, 3034, 3196, 3362, 3532, 3706,
];

// Blocos de correção de erro por versão, colunas L, M, Q, H (índice 0 não usado).
const BLOCOS_EC = [
  null,
  [1, 1, 1, 1], [1, 1, 1, 1], [1, 1, 2, 2], [1, 2, 2, 4], [1, 2, 4, 4],
  [2, 4, 4, 4], [2, 4, 6, 5], [2, 4, 6, 6], [2, 5, 8, 8], [4, 5, 8, 8],
  [4, 5, 8, 11], [4, 8, 10, 11], [4, 9, 12, 16], [4, 9, 16, 16], [6, 10, 12, 18],
  [6, 10, 17, 16], [6, 11, 16, 19], [6, 13, 18, 21], [7, 14, 21, 25], [8, 16, 20, 25],
  [8, 17, 23, 25], [9, 17, 23, 34], [9, 18, 25, 30], [10, 20, 27, 32], [12, 21, 29, 35],
  [12, 23, 34, 37], [12, 25, 34, 40], [13, 26, 35, 42], [14, 28, 38, 45], [15, 29, 40, 48],
  [16, 31, 43, 51], [17, 33, 45, 54], [18, 35, 48, 57], [19, 37, 51, 60], [19, 38, 53, 63],
  [20, 40, 56, 66], [21, 43, 59, 70], [22, 45, 62, 74], [24, 47, 65, 77], [25, 49, 68, 81],
];

// Total de codewords de correção de erro por versão, colunas L, M, Q, H (índice 0 não usado).
const CODEWORDS_EC = [
  null,
  [7, 10, 13, 17], [10, 16, 22, 28], [15, 26, 36, 44], [20, 36, 52, 64], [26, 48, 72, 88],
  [36, 64, 96, 112], [40, 72, 108, 130], [48, 88, 132, 156], [60, 110, 160, 192], [72, 130, 192, 224],
  [80, 150, 224, 264], [96, 176, 260, 308], [104, 198, 288, 352], [120, 216, 320, 384], [132, 240, 360, 432],
  [144, 280, 408, 480], [168, 308, 448, 532], [180, 338, 504, 588], [196, 364, 546, 650], [224, 416, 600, 700],
  [224, 442, 644, 750], [252, 476, 690, 816], [270, 504, 750, 900], [300, 560, 810, 960], [312, 588, 870, 1050],
  [336, 644, 952, 1110], [360, 700, 1020, 1200], [390, 728, 1050, 1260], [420, 784, 1140, 1350], [450, 812, 1200, 1440],
  [480, 868, 1290, 1530], [510, 924, 1350, 1620], [540, 980, 1440, 1710], [570, 1036, 1530, 1800], [570, 1064, 1590, 1890],
  [600, 1120, 1680, 1980], [630, 1204, 1770, 2100], [660, 1260, 1860, 2220], [720, 1316, 1950, 2310], [750, 1372, 2040, 2430],
];

const NIVEL_INDICE = { L: 0, M: 1, Q: 2, H: 3 }; // posição nas tabelas acima
const NIVEL_BITS = { L: 1, M: 0, Q: 3, H: 2 }; // bits do nível na informação de formato (fixos pelo padrão)

const G15 = 0x537; // gerador BCH(15,5) da informação de formato
const G15_MASCARA = 0x5412;
const G18 = 0x1f25; // gerador BCH(18,6) da informação de versão

const bitLen = (n) => { let d = 0; while (n) { d++; n >>>= 1; } return d; };

function bitsFormato(nivel, mascara) {
  const dados = (NIVEL_BITS[nivel] << 3) | mascara;
  let d = dados << 10;
  const grau = bitLen(G15);
  while (bitLen(d) - grau >= 0) d ^= G15 << (bitLen(d) - grau);
  return ((dados << 10) | d) ^ G15_MASCARA;
}

// ---------------------------------------------------------------- Montagem dos dados (modo byte)
class BufferDeBits {
  constructor() { this.bytes = []; this.tamanho = 0; }
  put(valor, bits) { for (let i = bits - 1; i >= 0; i--) this.putBit((valor >>> i) & 1); }
  putBit(bit) {
    const idx = this.tamanho >> 3;
    if (this.bytes.length <= idx) this.bytes.push(0);
    if (bit) this.bytes[idx] |= 0x80 >>> (this.tamanho % 8);
    this.tamanho++;
  }
  paraBytes() { return Uint8Array.from(this.bytes); }
}

const bitsContagem = (versao) => (versao < 10 ? 8 : 16);

/** Capacidade em bytes (modo byte) de uma versão/nível — usada para escolher a menor versão que serve. */
function capacidadeBytes(versao, nivel) {
  const total = TOTAL_CODEWORDS[versao];
  const ec = CODEWORDS_EC[versao][NIVEL_INDICE[nivel]];
  const bitsDados = (total - ec) * 8;
  const reservado = 4 + bitsContagem(versao);
  return Math.floor((bitsDados - reservado) / 8);
}

function escolherVersao(tamanhoBytes, nivel) {
  for (let v = 1; v <= 40; v++) if (tamanhoBytes <= capacidadeBytes(v, nivel)) return v;
  throw new Error('Texto muito grande para um QR Code (mesmo na versão 40)');
}

/** Monta os codewords finais (dados intercalados com correção de erro) para versão/nível dados. */
function montarCodewords(bytesEntrada, versao, nivel) {
  const total = TOTAL_CODEWORDS[versao];
  const ecTotal = CODEWORDS_EC[versao][NIVEL_INDICE[nivel]];
  const dataTotal = total - ecTotal;
  const blocos = BLOCOS_EC[versao][NIVEL_INDICE[nivel]];
  const grupo2 = total % blocos;
  const grupo1 = blocos - grupo2;
  const dadosGrupo1 = Math.floor(dataTotal / blocos);
  const dadosGrupo2 = dadosGrupo1 + 1;
  const ecPorBloco = Math.floor(total / blocos) - dadosGrupo1;

  const buf = new BufferDeBits();
  buf.put(0b0100, 4); // modo byte
  buf.put(bytesEntrada.length, bitsContagem(versao));
  for (const b of bytesEntrada) buf.put(b, 8);
  const bitsTotal = dataTotal * 8;
  if (buf.tamanho + 4 <= bitsTotal) buf.put(0, 4); // terminador
  while (buf.tamanho % 8 !== 0) buf.putBit(0);
  let alternancia = 0;
  while (buf.tamanho < bitsTotal) { buf.put(alternancia % 2 ? 0x11 : 0xec, 8); alternancia++; }
  const bytes = buf.paraBytes();

  const blocosDados = [];
  let offset = 0;
  for (let i = 0; i < blocos; i++) {
    const tam = i < grupo1 ? dadosGrupo1 : dadosGrupo2;
    blocosDados.push(bytes.slice(offset, offset + tam));
    offset += tam;
  }
  const gerador = polinomioGerador(ecPorBloco);
  const blocosEc = blocosDados.map((d) => codigosEc(d, gerador, ecPorBloco));

  const saida = new Uint8Array(total);
  let idx = 0;
  const maxDados = Math.max(...blocosDados.map((d) => d.length));
  for (let i = 0; i < maxDados; i++) for (const b of blocosDados) if (i < b.length) saida[idx++] = b[i];
  for (let i = 0; i < ecPorBloco; i++) for (const b of blocosEc) saida[idx++] = b[i];
  return saida;
}

// ---------------------------------------------------------------- Posições fixas (padrão ISO)
function posicoesAlinhamento(versao) {
  if (versao === 1) return [];
  const n = Math.floor(versao / 7) + 2;
  const tamanho = versao * 4 + 17;
  const intervalo = tamanho === 145 ? 26 : Math.ceil((tamanho - 13) / (2 * n - 2)) * 2;
  const eixo = [tamanho - 7];
  for (let i = 1; i < n - 1; i++) eixo.push(eixo[i - 1] - intervalo);
  eixo.push(6);
  eixo.reverse();
  const pares = [];
  for (let i = 0; i < eixo.length; i++) {
    for (let j = 0; j < eixo.length; j++) {
      // os três cantos ocupados pelos padrões de busca não recebem alinhamento
      if ((i === 0 && j === 0) || (i === 0 && j === eixo.length - 1) || (i === eixo.length - 1 && j === 0)) continue;
      pares.push([eixo[i], eixo[j]]);
    }
  }
  return pares;
}

// ---------------------------------------------------------------- As 8 máscaras + penalidades
const MASCARAS = [
  (r, c) => (r + c) % 2 === 0,
  (r) => r % 2 === 0,
  (_r, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r * c) % 3) + ((r + c) % 2)) % 2 === 0,
];

function penalidadeN1N2(matriz, n) {
  let pontos = 0;
  for (let r = 0; r < n; r++) {
    let seqCol = 0, seqRow = 0, ultCol = -1, ultRow = -1;
    for (let c = 0; c < n; c++) {
      const vCol = matriz[r][c];
      if (vCol === ultCol) seqCol++; else { if (seqCol >= 5) pontos += 3 + (seqCol - 5); ultCol = vCol; seqCol = 1; }
      const vRow = matriz[c][r];
      if (vRow === ultRow) seqRow++; else { if (seqRow >= 5) pontos += 3 + (seqRow - 5); ultRow = vRow; seqRow = 1; }
    }
    if (seqCol >= 5) pontos += 3 + (seqCol - 5);
    if (seqRow >= 5) pontos += 3 + (seqRow - 5);
  }
  for (let r = 0; r < n - 1; r++) {
    for (let c = 0; c < n - 1; c++) {
      const soma = matriz[r][c] + matriz[r][c + 1] + matriz[r + 1][c] + matriz[r + 1][c + 1];
      if (soma === 4 || soma === 0) pontos += 3;
    }
  }
  return pontos;
}

function penalidadeN3(matriz, n) {
  let pontos = 0;
  for (let r = 0; r < n; r++) {
    let bitsCol = 0, bitsRow = 0;
    for (let c = 0; c < n; c++) {
      bitsCol = ((bitsCol << 1) & 0x7ff) | matriz[r][c];
      if (c >= 10 && (bitsCol === 0x5d0 || bitsCol === 0x05d)) pontos += 40;
      bitsRow = ((bitsRow << 1) & 0x7ff) | matriz[c][r];
      if (c >= 10 && (bitsRow === 0x5d0 || bitsRow === 0x05d)) pontos += 40;
    }
  }
  return pontos;
}

function penalidadeN4(matriz, n) {
  let escuros = 0;
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) escuros += matriz[r][c];
  const pct = (escuros * 100) / (n * n);
  return Math.abs(Math.ceil(pct / 5) - 10) * 10;
}

// ---------------------------------------------------------------- Montagem da matriz completa
function bitsVersao(versao) {
  let d = versao << 12;
  const grau = bitLen(G18);
  while (bitLen(d) - grau >= 0) d ^= G18 << (bitLen(d) - grau);
  return (versao << 12) | d;
}

/**
 * Gera a matriz de módulos de um QR Code para `texto` (modo byte, ASCII/UTF-8).
 * @returns {{ tamanho: number, modulos: Uint8Array[], versao: number, nivel: string, mascara: number }}
 */
export function gerarMatrizQR(texto, { nivel = 'M' } = {}) {
  const bytes = new TextEncoder().encode(String(texto));
  const versao = escolherVersao(bytes.length, nivel);
  const codewords = montarCodewords(bytes, versao, nivel);

  const n = versao * 4 + 17;
  const matriz = Array.from({ length: n }, () => new Uint8Array(n));
  const reservado = Array.from({ length: n }, () => new Uint8Array(n));
  const set = (r, c, v, res) => {
    if (r < 0 || r >= n || c < 0 || c >= n) return;
    matriz[r][c] = v ? 1 : 0;
    if (res) reservado[r][c] = 1;
  };

  // Padrões de busca (3 cantos) com separador claro de 1 módulo.
  for (const [row, col] of [[0, 0], [n - 7, 0], [0, n - 7]]) {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const anel = (r >= 0 && r <= 6 && (c === 0 || c === 6)) || (c >= 0 && c <= 6 && (r === 0 || r === 6));
        const centro = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        set(row + r, col + c, anel || centro, true);
      }
    }
  }
  // Padrão de temporização.
  for (let i = 8; i < n - 8; i++) { const v = i % 2 === 0; set(i, 6, v, true); set(6, i, v, true); }
  // Padrões de alinhamento.
  for (const [row, col] of posicoesAlinhamento(versao)) {
    for (let r = -2; r <= 2; r++) {
      for (let c = -2; c <= 2; c++) {
        const anel = r === -2 || r === 2 || c === -2 || c === 2;
        set(row + r, col + c, anel || (r === 0 && c === 0), true);
      }
    }
  }
  // Reserva a área de informação de formato (conteúdo provisório; entra de verdade depois da máscara).
  const desenharFormato = (bits) => {
    for (let i = 0; i < 15; i++) {
      const bit = (bits >> i) & 1;
      if (i < 6) set(i, 8, bit, true);
      else if (i < 8) set(i + 1, 8, bit, true);
      else set(n - 15 + i, 8, bit, true);
      if (i < 8) set(8, n - i - 1, bit, true);
      else if (i < 9) set(8, 15 - i, bit, true);
      else set(8, 15 - i - 1, bit, true);
    }
    set(n - 8, 8, 1, true); // módulo escuro fixo
  };
  desenharFormato(bitsFormato(nivel, 0));
  if (versao >= 7) {
    const bv = bitsVersao(versao);
    for (let i = 0; i < 18; i++) {
      const row = Math.floor(i / 3);
      const col = (i % 3) + n - 11;
      const bit = (bv >> i) & 1;
      set(row, col, bit, true);
      set(col, row, bit, true);
    }
  }

  // Preenche os dados em zigue-zague, pulando o que já está reservado.
  let inc = -1, row = n - 1, bitIdx = 7, byteIdx = 0;
  for (let col = n - 1; col > 0; col -= 2) {
    if (col === 6) col--;
    while (true) {
      for (let c = 0; c < 2; c++) {
        const cc = col - c;
        if (!reservado[row][cc]) {
          const bit = byteIdx < codewords.length ? (codewords[byteIdx] >>> bitIdx) & 1 : 0;
          matriz[row][cc] = bit;
          bitIdx--;
          if (bitIdx === -1) { byteIdx++; bitIdx = 7; }
        }
      }
      row += inc;
      if (row < 0 || row >= n) { row -= inc; inc = -inc; break; }
    }
  }

  const aplicarMascara = (padrao) => {
    const fn = MASCARAS[padrao];
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (!reservado[r][c] && fn(r, c)) matriz[r][c] ^= 1;
  };

  let melhor = 0, menorPenalidade = Infinity;
  for (let p = 0; p < 8; p++) {
    desenharFormato(bitsFormato(nivel, p));
    aplicarMascara(p);
    const pontos = penalidadeN1N2(matriz, n) + penalidadeN3(matriz, n) + penalidadeN4(matriz, n);
    aplicarMascara(p); // reverte (XOR é involução)
    if (pontos < menorPenalidade) { menorPenalidade = pontos; melhor = p; }
  }
  desenharFormato(bitsFormato(nivel, melhor));
  aplicarMascara(melhor);

  return { tamanho: n, modulos: matriz, versao, nivel, mascara: melhor };
}
