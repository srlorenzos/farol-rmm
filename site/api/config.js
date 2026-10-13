// Diz ao site se a compra online está disponível (Stripe configurado). Não expõe nenhum segredo.
import { responder, exigirMetodo } from '../lib/http.js';
import { stripeConfigurado } from '../lib/stripe.js';
import { disponivel } from '../lib/armazenamento.js';

export default function handler(req, res) {
  if (!exigirMetodo(req, res, 'GET')) return;
  responder(res, 200, {
    compra: stripeConfigurado() && !!process.env.LICENCA_CHAVE_PRIVADA && disponivel() && !!process.env.STRIPE_WEBHOOK_SECRET,
    contato_salvo: disponivel(),
    email: process.env.CONTATO_EMAIL || 'lorenzoprofissional@gmail.com',
  }, { 'Cache-Control': 'public, max-age=60' });
}
