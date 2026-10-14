// Primitivas de segurança: senhas (scrypt), tokens aleatórios, TOTP (RFC 6238).
// Tudo com node:crypto, sem dependências externas.
import { scrypt, randomBytes, createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);

// Parâmetros do scrypt: N=2^15, r=8, p=1 (~32 MiB de memória por hash).
const SCRYPT = { N: 2 ** 15, r: 8, p: 1, tamanho: 64 };
const MAXMEM = 128 * 1024 * 1024;

export async function hashSenha(senha) {
  const sal = randomBytes(16);
  const hash = await scryptAsync(senha.normalize('NFKC'), sal, SCRYPT.tamanho, {
    N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p, maxmem: MAXMEM,
  });
  return ['scrypt', SCRYPT.N, SCRYPT.r, SCRYPT.p, sal.toString('base64'), hash.toString('base64')].join('$');
}

export async function verificarSenha(senha, armazenado) {
  const partes = String(armazenado || '').split('$');
  if (partes.length !== 6 || partes[0] !== 'scrypt') return false;
  const [, N, r, p, salB64, hashB64] = partes;
  const esperado = Buffer.from(hashB64, 'base64');
  const obtido = await scryptAsync(senha.normalize('NFKC'), Buffer.from(salB64, 'base64'), esperado.length, {
    N: Number(N), r: Number(r), p: Number(p), maxmem: MAXMEM,
  });
  return obtido.length === esperado.length && timingSafeEqual(obtido, esperado);
}

// Hash "fantasma" para equalizar o tempo de resposta quando o usuário não existe.
let hashFantasma;
export async function gastarTempoComoSenha(senha) {
  hashFantasma ??= await hashSenha('farol-usuario-inexistente');
  await verificarSenha(senha, hashFantasma);
  return false;
}

/** Token aleatório de 32 bytes em base64url. */
export function gerarToken(bytes = 32) {
  return randomBytes(bytes).toString('base64url');
}

/** SHA-256 em hex — usado para guardar tokens/segredos (que já têm alta entropia). */
export function sha256(texto) {
  return createHash('sha256').update(String(texto)).digest('hex');
}

/** Compara dois textos em tempo constante (após hash, para igualar tamanhos). */
export function iguaisSeguro(a, b) {
  const ha = createHash('sha256').update(String(a)).digest();
  const hb = createHash('sha256').update(String(b)).digest();
  return timingSafeEqual(ha, hb) && String(a).length === String(b).length;
}

// ---------- Base32 (RFC 4648) ----------
const ALFABETO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Codificar(buf) {
  let bits = 0, valor = 0, saida = '';
  for (const byte of buf) {
    valor = (valor << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      saida += ALFABETO[(valor >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) saida += ALFABETO[(valor << (5 - bits)) & 31];
  return saida;
}

export function base32Decodificar(texto) {
  const limpo = String(texto).toUpperCase().replace(/[\s=-]/g, '');
  let bits = 0, valor = 0;
  const saida = [];
  for (const c of limpo) {
    const i = ALFABETO.indexOf(c);
    if (i < 0) throw new Error('base32 inválido');
    valor = (valor << 5) | i;
    bits += 5;
    if (bits >= 8) {
      saida.push((valor >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(saida);
}

// ---------- HOTP / TOTP ----------
export function hotp(chave, contador, { digitos = 6, algoritmo = 'sha1' } = {}) {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(contador));
  const mac = createHmac(algoritmo, chave).update(msg).digest();
  const deslocamento = mac[mac.length - 1] & 0x0f;
  const binario = ((mac[deslocamento] & 0x7f) << 24) | (mac[deslocamento + 1] << 16)
    | (mac[deslocamento + 2] << 8) | mac[deslocamento + 3];
  return String(binario % 10 ** digitos).padStart(digitos, '0');
}

export function totp(chave, { tempoMs = Date.now(), passo = 30, digitos = 6, algoritmo = 'sha1' } = {}) {
  return hotp(chave, Math.floor(tempoMs / 1000 / passo), { digitos, algoritmo });
}

/**
 * Verifica um código TOTP aceitando ±1 passo de deriva.
 * Retorna o número do passo aceito (para impedir reuso) ou null.
 */
export function verificarTotp(segredoBase32, codigo, { tempoMs = Date.now(), janela = 1, ultimoPasso = -1 } = {}) {
  if (!/^\d{6}$/.test(String(codigo || ''))) return null;
  const chave = base32Decodificar(segredoBase32);
  const atual = Math.floor(tempoMs / 1000 / 30);
  for (let d = -janela; d <= janela; d++) {
    const passo = atual + d;
    if (passo <= ultimoPasso) continue;
    if (iguaisSeguro(hotp(chave, passo), String(codigo))) return passo;
  }
  return null;
}

export function novoSegredoTotp() {
  return base32Codificar(randomBytes(20));
}

export function uriOtpauth(segredo, usuario, emissor = 'Farol RMM') {
  const rotulo = encodeURIComponent(`${emissor}:${usuario}`);
  const params = new URLSearchParams({ secret: segredo, issuer: emissor, algorithm: 'SHA1', digits: '6', period: '30' });
  return `otpauth://totp/${rotulo}?${params}`;
}
