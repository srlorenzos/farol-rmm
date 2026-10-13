// Cria uma Stripe Checkout Session (assinatura) a partir do intervalo e da quantidade de dispositivos.
// O preço é SEMPRE recalculado aqui (publico/js/precos.js); o cliente só informa quantidade e intervalo.
import { responder, lerJson, excedeu, exigirMetodo, urlBase } from '../lib/http.js';
import { stripe, stripeConfigurado } from '../lib/stripe.js';
import { calcular, MIN_PAGO, MAX_DISPOSITIVOS, NOMES_PLANO } from '../publico/js/precos.js';

const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;

export default async function handler(req, res) {
  if (!exigirMetodo(req, res, 'POST')) return;
  if (excedeu(req, 'checkout', 10, 10 * 60_000)) return responder(res, 429, { erro: 'Muitas tentativas. Aguarde alguns minutos.' });
  if (!stripeConfigurado() || !process.env.LICENCA_CHAVE_PRIVADA || !process.env.STRIPE_WEBHOOK_SECRET) {
    return responder(res, 503, { erro: 'A compra online ainda não está disponível. Fale com vendas.', vendas: true });
  }
  let corpo;
  try { corpo = await lerJson(req); } catch (e) { return responder(res, e.status || 400, { erro: e.message }); }

  const quantidade = corpo.dispositivos;
  const intervalo = corpo.intervalo === 'ano' ? 'ano' : corpo.intervalo === 'mes' ? 'mes' : null;
  if (!Number.isInteger(quantidade) || quantidade < MIN_PAGO || quantidade > MAX_DISPOSITIVOS) {
    return responder(res, 400, { erro: `Informe de ${MIN_PAGO} a ${MAX_DISPOSITIVOS} dispositivos. Até 5 é grátis, sem pagamento.` });
  }
  if (!intervalo) return responder(res, 400, { erro: 'Intervalo inválido (mes ou ano).' });
  const email = typeof corpo.email === 'string' ? corpo.email.trim() : '';
  if (email && !EMAIL.test(email)) return responder(res, 400, { erro: 'E-mail inválido.' });

  const preco = calcular(quantidade, intervalo);
  const base = urlBase(req);
  const meta = { plano: preco.plano, dispositivos: String(quantidade), intervalo };
  try {
    const sessao = await stripe('POST', 'checkout/sessions', {
      mode: 'subscription',
      locale: 'pt-BR',
      success_url: `${base}/sucesso.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/#precos`,
      allow_promotion_codes: 'true',
      billing_address_collection: 'auto',
      customer_email: email || undefined,
      custom_fields: [{ key: 'empresa', label: { type: 'custom', custom: 'Nome da empresa (aparece na licença)' }, type: 'text', text: { maximum_length: 80 } }],
      line_items: [{
        quantity: 1,
        price_data: {
          currency: 'brl',
          unit_amount: preco.total,
          recurring: { interval: intervalo === 'ano' ? 'year' : 'month' },
          product_data: { name: `Farol RMM ${NOMES_PLANO[preco.plano]}: ${quantidade} dispositivos (${intervalo === 'ano' ? 'anual' : 'mensal'})` },
        },
      }],
      metadata: meta,
      subscription_data: { metadata: meta },
    });
    return responder(res, 200, { url: sessao.url });
  } catch (e) {
    console.error('checkout falhou:', e.message);
    return responder(res, 502, { erro: 'Não foi possível iniciar o pagamento agora. Tente de novo ou fale com vendas.' });
  }
}
