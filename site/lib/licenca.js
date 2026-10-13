// Emissão de licença Ed25519 (formato lido por servidor/src/modulos/licenca/chave.js).
import { createPrivateKey, sign, randomUUID } from 'node:crypto';

function chavePrivada() {
  const bruta = process.env.LICENCA_CHAVE_PRIVADA;
  if (!bruta) throw new Error('LICENCA_CHAVE_PRIVADA não configurada');
  return createPrivateKey(bruta.replace(/\\n/g, '\n'));
}

export function emitirLicenca({ cliente, email, plano, dispositivos_max, expira_em, id }) {
  const payload = { id: id ?? randomUUID(), cliente, email: email ?? null, plano, dispositivos_max, emitida_em: Date.now(), expira_em: expira_em ?? null };
  const corpo = Buffer.from(JSON.stringify(payload), 'utf8');
  const assinatura = sign(null, corpo, chavePrivada());
  return { licenca: payload, chave: `FAROL-${corpo.toString('base64url')}.${assinatura.toString('base64url')}` };
}
