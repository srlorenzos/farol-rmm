// Verificação offline de licenças do Farol RMM (Ed25519).
// Formato: "FAROL-<payload base64url>.<assinatura base64url>", payload = JSON {id, cliente, email, plano,
// dispositivos_max, emitida_em, expira_em}. A chave PRIVADA nunca está neste repositório: ela fica só no site
// de vendas (env LICENCA_CHAVE_PRIVADA) e na pasta de segredos do dono.
import { createPublicKey, createPrivateKey, sign, verify } from 'node:crypto';

// Chave pública (SPKI DER em base64). Pode ser trocada em testes via verificar(texto, { chavePublica }).
export const CHAVE_PUBLICA_B64 = 'MCowBQYDK2VwAyEALTYPeUttBm+MweMHQcd3w3RmkajlQUGur28dOV2pd5o=';

export const LIMITE_GRATIS = 5;
export const CARENCIA_DIAS = 7;
export const AVISO_DIAS = 15;
const DIA = 86_400_000;
const PREFIXO = 'FAROL-';

const b64u = (buf) => Buffer.from(buf).toString('base64url');

function objetoChavePublica(b64) {
  return createPublicKey({ key: Buffer.from(b64, 'base64'), format: 'der', type: 'spki' });
}

/** Emite uma licença (uso do dono/site). `chavePrivada` é PEM PKCS8. */
export function assinar(dados, chavePrivada) {
  const payload = {
    id: dados.id, cliente: dados.cliente, email: dados.email ?? null, plano: dados.plano,
    dispositivos_max: dados.dispositivos_max, emitida_em: dados.emitida_em ?? Date.now(), expira_em: dados.expira_em ?? null,
  };
  const corpo = Buffer.from(JSON.stringify(payload), 'utf8');
  const assinatura = sign(null, corpo, createPrivateKey(chavePrivada));
  return `${PREFIXO}${b64u(corpo)}.${b64u(assinatura)}`;
}

/** Valida assinatura e formato. Devolve { ok: true, licenca } ou { ok: false, erro }. */
export function verificar(texto, { chavePublica = CHAVE_PUBLICA_B64 } = {}) {
  const t = String(texto ?? '').trim().replace(/\s+/g, '');
  if (!t.startsWith(PREFIXO)) return { ok: false, erro: 'Formato inválido: a chave começa com "FAROL-".' };
  const [p, s, ...resto] = t.slice(PREFIXO.length).split('.');
  if (!p || !s || resto.length) return { ok: false, erro: 'Formato inválido da chave de licença.' };
  const corpo = Buffer.from(p, 'base64url');
  const assinatura = Buffer.from(s, 'base64url');
  let valida = false;
  try { valida = verify(null, corpo, objetoChavePublica(chavePublica), assinatura); } catch { valida = false; }
  if (!valida) return { ok: false, erro: 'Assinatura inválida: a chave foi adulterada ou não é do Farol.' };
  let l;
  try { l = JSON.parse(corpo.toString('utf8')); } catch { return { ok: false, erro: 'Conteúdo da licença ilegível.' }; }
  if (!l || typeof l !== 'object' || typeof l.plano !== 'string' || !Number.isInteger(l.dispositivos_max) || l.dispositivos_max < 0
    || typeof l.id !== 'string' || typeof l.cliente !== 'string') return { ok: false, erro: 'Conteúdo da licença inválido.' };
  if (l.expira_em != null && !Number.isFinite(l.expira_em)) return { ok: false, erro: 'Validade da licença inválida.' };
  return { ok: true, licenca: l };
}

/**
 * Situação da licença em `agora`.
 *  - gratis: sem licença (ou inválida) -> limite de 5
 *  - ativa: dentro da validade (ou sem validade)
 *  - carencia: expirou há até 7 dias; segue valendo, com aviso
 *  - expirada: passou da carência -> volta ao limite grátis
 * dispositivos_max = 0 significa ilimitado.
 */
export function situacao(licenca, agora = Date.now()) {
  if (!licenca) return { estado: 'gratis', limite: LIMITE_GRATIS, ilimitado: false, plano: 'gratis', dias_restantes: null, expira_em: null };
  const exp = licenca.expira_em;
  const ilimitado = licenca.dispositivos_max === 0;
  const base = { plano: licenca.plano, ilimitado, expira_em: exp ?? null };
  if (exp == null || agora <= exp) {
    const dias = exp == null ? null : Math.ceil((exp - agora) / DIA);
    return { ...base, estado: 'ativa', limite: ilimitado ? null : licenca.dispositivos_max, dias_restantes: dias, aviso_expiracao: dias != null && dias <= AVISO_DIAS };
  }
  const apos = agora - exp;
  if (apos <= CARENCIA_DIAS * DIA) {
    return { ...base, estado: 'carencia', limite: ilimitado ? null : licenca.dispositivos_max, dias_restantes: 0, carencia_restante: Math.ceil((CARENCIA_DIAS * DIA - apos) / DIA), aviso_expiracao: true };
  }
  return { ...base, estado: 'expirada', limite: LIMITE_GRATIS, ilimitado: false, dias_restantes: 0, aviso_expiracao: true };
}
