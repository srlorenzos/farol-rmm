// Webhook do Stripe: valida a assinatura (corpo raw) e emite/renova a licença.
//  - checkout.session.completed (assinatura paga) -> emite a licença e guarda em farol/licencas/sessao-<id>.json
//  - invoice.paid (renovação, billing_reason = subscription_cycle) -> reemite com a nova validade, na mesma sessão
// Idempotente: reentregas do mesmo evento não geram licenças duplicadas.
import { responder, lerRaw, exigirMetodo } from '../lib/http.js';
import { stripe, verificarAssinatura } from '../lib/stripe.js';
import { emitirLicenca } from '../lib/licenca.js';
import { ler, gravar, disponivel, caminhoSessao, caminhoAssinatura } from '../lib/armazenamento.js';
import { MAX_DISPOSITIVOS, MIN_PAGO } from '../publico/js/precos.js';

const ID_STRIPE = /^[a-z]{2,4}_(?:test_|live_)?[A-Za-z0-9]{8,200}$/;

async function fimDoPeriodo(assinaturaId, intervalo) {
  try {
    const s = await stripe('GET', `subscriptions/${assinaturaId}`);
    const fim = s.current_period_end ?? s.items?.data?.[0]?.current_period_end;
    if (fim) return fim * 1000;
  } catch (e) { console.error('não consegui ler a assinatura:', e.message); }
  return Date.now() + (intervalo === 'ano' ? 366 : 32) * 86_400_000;
}

function dadosDaCompra(sessao) {
  const m = sessao.metadata ?? {};
  const dispositivos = Number.parseInt(m.dispositivos, 10);
  if (!Number.isInteger(dispositivos) || dispositivos < MIN_PAGO || dispositivos > MAX_DISPOSITIVOS) throw new Error('metadata.dispositivos inválido');
  const empresa = sessao.custom_fields?.find((c) => c.key === 'empresa')?.text?.value?.trim();
  const email = sessao.customer_details?.email ?? sessao.customer_email ?? null;
  return {
    dispositivos, plano: m.plano === 'msp' ? 'msp' : 'profissional', intervalo: m.intervalo === 'ano' ? 'ano' : 'mes',
    cliente: (empresa || sessao.customer_details?.name || email || 'Cliente Farol').slice(0, 120), email,
  };
}

async function aoConcluirCheckout(sessao) {
  if (sessao.mode !== 'subscription' || !['paid', 'no_payment_required'].includes(sessao.payment_status)) return 'ignorado: sessão não paga';
  if (!ID_STRIPE.test(sessao.id)) throw new Error('id de sessão inesperado');
  if (await ler(caminhoSessao(sessao.id))) return 'já emitida';
  const c = dadosDaCompra(sessao);
  const expira = await fimDoPeriodo(sessao.subscription, c.intervalo);
  const { licenca, chave } = emitirLicenca({ cliente: c.cliente, email: c.email, plano: c.plano, dispositivos_max: c.dispositivos, expira_em: expira });
  const agora = Date.now();
  await gravar(caminhoSessao(sessao.id), { sessao: sessao.id, assinatura: sessao.subscription, intervalo: c.intervalo, licenca, chave, criada_em: agora, atualizada_em: agora });
  if (sessao.subscription && ID_STRIPE.test(sessao.subscription)) await gravar(caminhoAssinatura(sessao.subscription), { sessao: sessao.id });
  return `licença ${licenca.id} emitida`;
}

async function aoPagarFatura(fatura) {
  if (fatura.billing_reason !== 'subscription_cycle') return 'ignorado: não é renovação';
  const assinatura = fatura.subscription ?? fatura.parent?.subscription_details?.subscription;
  if (!assinatura || !ID_STRIPE.test(assinatura)) return 'ignorado: sem assinatura';
  const ref = await ler(caminhoAssinatura(assinatura));
  const reg = ref && await ler(caminhoSessao(ref.sessao));
  if (!reg) return 'ignorado: assinatura sem licença registrada';
  const fim = fatura.lines?.data?.[0]?.period?.end;
  const expira = fim ? fim * 1000 : await fimDoPeriodo(assinatura, reg.intervalo);
  if (reg.licenca.expira_em && expira <= reg.licenca.expira_em) return 'já renovada';
  const { licenca, chave } = emitirLicenca({ ...reg.licenca, expira_em: expira });
  await gravar(caminhoSessao(reg.sessao), { ...reg, licenca, chave, atualizada_em: Date.now() });
  return `licença renovada até ${new Date(expira).toISOString()}`;
}

export default async function handler(req, res) {
  if (!exigirMetodo(req, res, 'POST')) return;
  const segredo = process.env.STRIPE_WEBHOOK_SECRET;
  if (!segredo || !process.env.LICENCA_CHAVE_PRIVADA || !disponivel()) return responder(res, 503, { erro: 'Webhook não configurado' });
  let bruto;
  try { bruto = await lerRaw(req); } catch (e) { return responder(res, e.status || 400, { erro: e.message }); }
  if (!verificarAssinatura(bruto, req.headers['stripe-signature'], segredo)) return responder(res, 400, { erro: 'Assinatura inválida' });
  let evento;
  try { evento = JSON.parse(bruto.toString('utf8')); } catch { return responder(res, 400, { erro: 'JSON inválido' }); }
  try {
    let resultado = 'ignorado';
    if (evento.type === 'checkout.session.completed' || evento.type === 'checkout.session.async_payment_succeeded') resultado = await aoConcluirCheckout(evento.data.object);
    else if (evento.type === 'invoice.paid') resultado = await aoPagarFatura(evento.data.object);
    console.log(`webhook ${evento.type} ${evento.id}: ${resultado}`);
    return responder(res, 200, { recebido: true, resultado });
  } catch (e) {
    console.error(`webhook ${evento?.type} ${evento?.id} falhou:`, e.message);
    return responder(res, 500, { erro: 'Falha ao processar; o Stripe vai tentar de novo.' });
  }
}
