// Cliente mínimo da API REST do Stripe (sem SDK) e verificação de assinatura de webhook.
import { createHmac, timingSafeEqual } from 'node:crypto';

export const stripeConfigurado = () => !!process.env.STRIPE_SECRET_KEY;

function achatar(obj, prefixo = '', saida = []) {
  for (const [k, v] of Object.entries(obj)) {
    if (v == null) continue;
    const chave = prefixo ? `${prefixo}[${k}]` : k;
    if (Array.isArray(v)) v.forEach((x, i) => (typeof x === 'object' ? achatar(x, `${chave}[${i}]`, saida) : saida.push([`${chave}[${i}]`, String(x)])));
    else if (typeof v === 'object') achatar(v, chave, saida);
    else saida.push([chave, String(v)]);
  }
  return saida;
}

export async function stripe(metodo, caminho, dados) {
  const r = await fetch(`https://api.stripe.com/v1/${caminho}`, {
    method: metodo,
    headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, ...(dados ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}) },
    body: dados ? new URLSearchParams(achatar(dados)).toString() : undefined,
    signal: AbortSignal.timeout(15_000),
  });
  const json = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(json?.error?.message || `Stripe respondeu ${r.status}`), { status: r.status, stripe: json?.error });
  return json;
}

/** Valida o cabeçalho Stripe-Signature (HMAC-SHA256 de "<t>.<corpo>") com tolerância de 5 minutos. */
export function verificarAssinatura(corpoRaw, cabecalho, segredo, { agora = Date.now(), tolerancia = 300 } = {}) {
  if (!segredo || !cabecalho) return false;
  const partes = String(cabecalho).split(',').map((p) => p.trim().split('='));
  const t = partes.find(([k]) => k === 't')?.[1];
  const assinaturas = partes.filter(([k]) => k === 'v1').map(([, v]) => v);
  if (!t || !assinaturas.length || Math.abs(agora / 1000 - Number(t)) > tolerancia) return false;
  const esperado = createHmac('sha256', segredo).update(`${t}.`).update(corpoRaw).digest();
  return assinaturas.some((s) => {
    const b = Buffer.from(s, 'hex');
    return b.length === esperado.length && timingSafeEqual(b, esperado);
  });
}
