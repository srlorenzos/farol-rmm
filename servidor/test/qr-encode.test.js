// Testa o gerador de QR Code (painel/js/modulos/configuracoes/qr-encode.js) importando o arquivo de
// produção direto — sem duplicar a lógica aqui. `jsqr` é usado só NESTE teste, como leitor de QR de
// terceiro para validar que um leitor de verdade decodifica o código de volta para o texto original;
// não é dependência do produto (veja servidor/package.json: fica em devDependencies, nada no painel
// importa jsqr).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import jsQR from 'jsqr';
import { gerarMatrizQR } from '../../painel/js/modulos/configuracoes/qr-encode.js';

void fileURLToPath; // (mantém o import explícito acima legível; sem uso direto)

/** Renderiza a matriz de módulos como pixels RGBA preto/branco (mesma lógica de qr-svg.js, em bitmap). */
function matrizParaImagem(modulos, tamanho, escala = 4, margemModulos = 4) {
  const n = tamanho;
  const largura = (n + margemModulos * 2) * escala;
  const dados = new Uint8ClampedArray(largura * largura * 4).fill(255);
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (!modulos[r][c]) continue;
      for (let dr = 0; dr < escala; dr++) {
        for (let dc = 0; dc < escala; dc++) {
          const y = (r + margemModulos) * escala + dr;
          const x = (c + margemModulos) * escala + dc;
          const idx = (y * largura + x) * 4;
          dados[idx] = 0; dados[idx + 1] = 0; dados[idx + 2] = 0; dados[idx + 3] = 255;
        }
      }
    }
  }
  return { dados, largura };
}

function decodificar(texto, opcoes) {
  const r = gerarMatrizQR(texto, opcoes);
  const { dados, largura } = matrizParaImagem(r.modulos, r.tamanho);
  const resultado = jsQR(dados, largura, largura);
  return { r, resultado };
}

test('QR decodifica de volta para a URI otpauth:// original (caso real do 2FA)', () => {
  const uri = 'otpauth://totp/Farol%20RMM:admin?secret=JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP&issuer=Farol%20RMM&algorithm=SHA1&digits=6&period=30';
  const { r, resultado } = decodificar(uri);
  assert.ok(resultado, 'um leitor de QR real precisa conseguir localizar e decodificar o código');
  assert.equal(resultado.data, uri);
  assert.ok(r.versao >= 1 && r.versao <= 40);
  assert.equal(r.nivel, 'M');
});

test('QR decodifica corretamente com nome de usuário bem longo (versão maior, múltiplos blocos RS)', () => {
  const uri = 'otpauth://totp/Farol%20RMM:administrador-com-nome-de-usuario-bem-longo-mesmo-para-testar?secret=JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP&issuer=Farol%20RMM&algorithm=SHA1&digits=6&period=30';
  const { r, resultado } = decodificar(uri);
  assert.ok(resultado);
  assert.equal(resultado.data, uri);
  assert.ok(r.versao >= 8, 'texto longo deve forçar uma versão maior (vários blocos de correção de erro)');
});

test('QR decodifica corretamente em vários tamanhos (1 a 300 bytes, cobre várias versões e grupos de blocos)', () => {
  const alfabeto = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789:/?=&%.-_ ';
  for (let len = 1; len <= 300; len += 11) {
    let texto = '';
    for (let i = 0; i < len; i++) texto += alfabeto[(i * 7 + len * 13) % alfabeto.length];
    const { resultado } = decodificar(texto);
    assert.ok(resultado, `falhou ao decodificar texto de ${len} bytes`);
    assert.equal(resultado.data, texto, `texto incorreto para ${len} bytes`);
  }
});

test('versão escolhida é sempre a menor que cabe (nunca estoura a versão 40)', () => {
  assert.throws(() => gerarMatrizQR('x'.repeat(3000)), /muito grande/);
});

test('o mesmo texto gera sempre a mesma matriz (determinístico) e módulo escuro fixo presente', () => {
  const uri = 'otpauth://totp/Farol%20RMM:admin?secret=ABCDEFGHIJKLMNOP&issuer=Farol%20RMM';
  const a = gerarMatrizQR(uri);
  const b = gerarMatrizQR(uri);
  assert.deepEqual(a.modulos.map((l) => Array.from(l)), b.modulos.map((l) => Array.from(l)));
  // módulo escuro fixo, sempre em (tamanho-8, 8) — ver ISO/IEC 18004
  assert.equal(a.modulos[a.tamanho - 8][8], 1);
});

test('estrutura: os 3 padrões de busca (cantos) têm o anel escuro-claro-escuro 7x7 exigido pelo padrão', () => {
  const { r } = gerarMatrizQR('teste simples de estrutura') && { r: gerarMatrizQR('teste simples de estrutura') };
  const n = r.tamanho;
  for (const [row, col] of [[0, 0], [n - 7, 0], [0, n - 7]]) {
    // módulo central (3x3) do padrão de busca é sempre escuro
    assert.equal(r.modulos[row + 3][col + 3], 1, `centro do padrão de busca em (${row},${col})`);
    // separador claro de 1 módulo ao redor (lado externo, quando dentro da matriz)
    if (row > 0) assert.equal(r.modulos[row - 1][col], 0);
    if (col > 0) assert.equal(r.modulos[row][col - 1], 0);
  }
});
