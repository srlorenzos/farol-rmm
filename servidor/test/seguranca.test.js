import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  hashSenha, verificarSenha, hotp, totp, verificarTotp, base32Codificar, base32Decodificar, gerarToken, sha256, iguaisSeguro,
} from '../src/seguranca.js';

test('hash de senha: scrypt com salt aleatório e verificação', async () => {
  const h1 = await hashSenha('minha-senha-secreta');
  const h2 = await hashSenha('minha-senha-secreta');
  assert.match(h1, /^scrypt\$32768\$8\$1\$/);
  assert.notEqual(h1, h2, 'salt deve ser diferente');
  assert.equal(await verificarSenha('minha-senha-secreta', h1), true);
  assert.equal(await verificarSenha('minha-senha-errada', h1), false);
  assert.equal(await verificarSenha('x', 'lixo'), false);
});

test('base32 ida e volta', () => {
  const buf = Buffer.from('12345678901234567890');
  assert.equal(base32Codificar(buf), 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
  assert.deepEqual(base32Decodificar('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ'), buf);
});

test('HOTP: vetores do RFC 4226', () => {
  const chave = Buffer.from('12345678901234567890');
  const esperados = ['755224', '287082', '359152', '969429', '338314', '254676', '287922', '162583', '399871', '520489'];
  esperados.forEach((c, i) => assert.equal(hotp(chave, i), c));
});

test('TOTP: vetores do RFC 6238 (SHA1, SHA256, SHA512)', () => {
  const chaves = {
    sha1: Buffer.from('12345678901234567890'),
    sha256: Buffer.from('12345678901234567890123456789012'),
    sha512: Buffer.from('1234567890123456789012345678901234567890123456789012345678901234'),
  };
  const vetores = [
    [59, '94287082', '46119246', '90693936'],
    [1111111109, '07081804', '68084774', '25091201'],
    [1111111111, '14050471', '67062674', '99943326'],
    [1234567890, '89005924', '91819424', '93441116'],
    [2000000000, '69279037', '90698825', '38618901'],
    [20000000000, '65353130', '77737706', '47863826'],
  ];
  for (const [t, s1, s256, s512] of vetores) {
    assert.equal(totp(chaves.sha1, { tempoMs: t * 1000, digitos: 8, algoritmo: 'sha1' }), s1, `sha1 t=${t}`);
    assert.equal(totp(chaves.sha256, { tempoMs: t * 1000, digitos: 8, algoritmo: 'sha256' }), s256, `sha256 t=${t}`);
    assert.equal(totp(chaves.sha512, { tempoMs: t * 1000, digitos: 8, algoritmo: 'sha512' }), s512, `sha512 t=${t}`);
  }
});

test('verificarTotp aceita ±1 passo e recusa reuso', () => {
  const segredo = base32Codificar(Buffer.from('12345678901234567890'));
  const agora = 1_700_000_000_000;
  const codigo = totp(base32Decodificar(segredo), { tempoMs: agora });
  const passo = verificarTotp(segredo, codigo, { tempoMs: agora });
  assert.equal(passo, Math.floor(agora / 30000));
  assert.ok(verificarTotp(segredo, codigo, { tempoMs: agora + 30_000 }) != null, 'deriva de +1 passo');
  assert.equal(verificarTotp(segredo, codigo, { tempoMs: agora + 90_000 }), null, 'fora da janela');
  assert.equal(verificarTotp(segredo, codigo, { tempoMs: agora, ultimoPasso: passo }), null, 'reuso');
  assert.equal(verificarTotp(segredo, 'abc123', { tempoMs: agora }), null);
});

test('tokens: aleatórios, 32 bytes, comparação segura', () => {
  const t = gerarToken();
  assert.equal(Buffer.from(t, 'base64url').length, 32);
  assert.notEqual(t, gerarToken());
  assert.equal(sha256('abc').length, 64);
  assert.equal(iguaisSeguro('abc', 'abc'), true);
  assert.equal(iguaisSeguro('abc', 'abd'), false);
  assert.equal(iguaisSeguro('abc', 'abcd'), false);
});
