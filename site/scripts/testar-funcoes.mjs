// Runner local das funções da Vercel: importa os handlers e chama com req/res falsos. Uso: node scripts/testar-funcoes.mjs
import assert from 'node:assert/strict';
import { createHmac, generateKeyPairSync } from 'node:crypto';
import { Readable } from 'node:stream';
import { verify } from 'node:crypto';
import { calcular } from '../publico/js/precos.js';

const memoria = new Map();
const { definirArmazenamento } = await import('../lib/armazenamento.js');
definirArmazenamento({ async ler(c) { return memoria.has(c) ? structuredClone(memoria.get(c)) : null; }, async gravar(c, v) { memoria.set(c, structuredClone(v)); } });

const par = generateKeyPairSync('ed25519');
const pem = par.privateKey.export({ type: 'pkcs8', format: 'pem' });
let ip = 1;

function chamar(handler, { metodo = 'GET', url = '/', corpo, bruto, headers = {} } = {}) {
  const req = bruto != null ? Readable.from([Buffer.from(bruto)]) : Readable.from([]);
  req.method = metodo; req.url = url; req.headers = { host: 'localhost:3000', 'x-forwarded-for': `10.0.0.${ip}`, ...headers };
  if (corpo !== undefined) req.body = corpo;
  return new Promise((resolve) => {
    const res = { headers: {}, statusCode: 200, setHeader(k, v) { this.headers[k.toLowerCase()] = v; }, end(txt) { resolve({ status: this.statusCode, json: txt ? JSON.parse(txt) : null, headers: this.headers }); } };
    handler(req, res);
  });
}
const novoIp = () => { ip += 1; };

// ---- preços
assert.equal(calcular(5).total, 0);
assert.equal(calcular(6).total, 990 * 1);
assert.equal(calcular(50).total, 990 * 45);
assert.equal(calcular(51).total, 990 * 45 + 790);
assert.equal(calcular(10, 'ano').total, Math.round(990 * 5 * 12 * 0.8));
assert.ok(calcular(49).total < calcular(50).total && calcular(50).total < calcular(51).total, 'preço monotônico');
assert.throws(() => calcular(99999));
console.log('ok precos');

const { default: config } = await import('../api/config.js');
const { default: checkout } = await import('../api/checkout.js');
const { default: webhook } = await import('../api/webhook.js');
const { default: licenca } = await import('../api/licenca.js');
const { default: contato } = await import('../api/contato.js');

// ---- sem nenhuma variável: tudo cai em "fale com vendas"
for (const k of ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'LICENCA_CHAVE_PRIVADA', 'BLOB_READ_WRITE_TOKEN']) delete process.env[k];
assert.equal((await chamar(config)).json.compra, false);
let r = await chamar(checkout, { metodo: 'POST', corpo: { dispositivos: 10, intervalo: 'mes' } });
assert.equal(r.status, 503); assert.equal(r.json.vendas, true);
assert.equal((await chamar(checkout, { metodo: 'GET' })).status, 405);
console.log('ok sem stripe');

// ---- contato
novoIp();
r = await chamar(contato, { metodo: 'POST', corpo: { nome: 'Ana', email: 'ana@exemplo.com.br', dispositivos: 30, mensagem: 'Olá' } });
assert.equal(r.status, 200);
assert.equal(r.json.salvo, true, 'armazenamento de teste está disponível');
assert.ok([...memoria.keys()].some((k) => k.startsWith('farol/contatos/')));
assert.equal((await chamar(contato, { metodo: 'POST', corpo: { nome: '', email: 'x' } })).status, 400);
assert.equal((await chamar(contato, { metodo: 'POST', corpo: { nome: 'A', email: 'a@b.co', dispositivos: -3 } })).status, 400);
const antes = memoria.size;
assert.equal((await chamar(contato, { metodo: 'POST', corpo: { nome: 'Bot', email: 'b@b.co', site: 'http://spam' } })).status, 200);
assert.equal(memoria.size, antes, 'isca não grava');
novoIp();
let ultimo;
for (let i = 0; i < 7; i++) ultimo = await chamar(contato, { metodo: 'POST', corpo: { nome: 'Rate', email: 'r@r.co' } });
assert.equal(ultimo.status, 429, 'rate limit por IP');
console.log('ok contato');

// ---- com tudo configurado
process.env.STRIPE_SECRET_KEY = 'sk_test_x'; process.env.STRIPE_WEBHOOK_SECRET = 'whsec_teste';
process.env.LICENCA_CHAVE_PRIVADA = pem.replace(/\n/g, '\\n'); process.env.SITE_URL = 'https://farol.exemplo';
assert.equal((await chamar(config)).json.compra, true);

// checkout: valida entrada e monta a sessão (fetch do Stripe simulado)
const fetchReal = globalThis.fetch;
const chamadas = [];
globalThis.fetch = async (url, init) => {
  chamadas.push({ url: String(url), body: init?.body });
  if (String(url).includes('checkout/sessions')) return new Response(JSON.stringify({ id: 'cs_test_abc', url: 'https://checkout.stripe.com/c/pay/cs_test_abc' }), { status: 200 });
  if (String(url).includes('subscriptions/')) return new Response(JSON.stringify({ current_period_end: Math.floor(Date.now() / 1000) + 30 * 86400 }), { status: 200 });
  return new Response('{}', { status: 404 });
};
novoIp();
assert.equal((await chamar(checkout, { metodo: 'POST', corpo: { dispositivos: 3, intervalo: 'mes' } })).status, 400);
assert.equal((await chamar(checkout, { metodo: 'POST', corpo: { dispositivos: 10, intervalo: 'sempre' } })).status, 400);
assert.equal((await chamar(checkout, { metodo: 'POST', corpo: { dispositivos: '10', intervalo: 'mes' } })).status, 400);
assert.equal((await chamar(checkout, { metodo: 'POST', corpo: { dispositivos: 10, intervalo: 'mes', email: 'ruim' } })).status, 400);
r = await chamar(checkout, { metodo: 'POST', corpo: { dispositivos: 20, intervalo: 'ano', email: 'dono@empresa.com', preco: 1 } });
assert.equal(r.status, 200); assert.match(r.json.url, /^https:\/\/checkout\.stripe\.com\//);
const form = new URLSearchParams(chamadas.at(-1).body);
assert.equal(form.get('line_items[0][price_data][unit_amount]'), String(calcular(20, 'ano').total), 'preço vem do servidor');
assert.equal(form.get('line_items[0][price_data][recurring][interval]'), 'year');
assert.equal(form.get('mode'), 'subscription');
assert.equal(form.get('success_url'), 'https://farol.exemplo/sucesso.html?session_id={CHECKOUT_SESSION_ID}');
assert.equal(form.get('metadata[dispositivos]'), '20');
console.log('ok checkout');

// webhook
const sessaoId = 'cs_test_a1B2c3D4e5F6g7H8i9J0kLmN';
const sessao = { id: sessaoId, mode: 'subscription', payment_status: 'paid', subscription: 'sub_1ABCdef23456789', customer_details: { email: 'dono@empresa.com', name: 'Dono' },
  custom_fields: [{ key: 'empresa', text: { value: 'Empresa Teste Ltda' } }], metadata: { plano: 'profissional', dispositivos: '20', intervalo: 'mes' } };
const assinar = (corpo, segredo = 'whsec_teste', t = Math.floor(Date.now() / 1000)) => `t=${t},v1=${createHmac('sha256', segredo).update(`${t}.${corpo}`).digest('hex')}`;
const evento = (type, obj) => JSON.stringify({ id: `evt_${type}`, type, data: { object: obj } });

let corpo = evento('checkout.session.completed', sessao);
r = await chamar(webhook, { metodo: 'POST', bruto: corpo, headers: { 'stripe-signature': 'lixo' } });
assert.equal(r.status, 400, 'assinatura inválida');
r = await chamar(webhook, { metodo: 'POST', bruto: corpo, headers: { 'stripe-signature': assinar(corpo, 'outro-segredo') } });
assert.equal(r.status, 400, 'segredo errado');
r = await chamar(webhook, { metodo: 'POST', bruto: corpo, headers: { 'stripe-signature': assinar(corpo, 'whsec_teste', 1000) } });
assert.equal(r.status, 400, 'timestamp antigo');
r = await chamar(webhook, { metodo: 'POST', bruto: corpo + ' ', headers: { 'stripe-signature': assinar(corpo) } });
assert.equal(r.status, 400, 'corpo adulterado');
assert.equal(memoria.has(`farol/licencas/sessao-${sessaoId}.json`), false);

r = await chamar(webhook, { metodo: 'POST', bruto: corpo, headers: { 'stripe-signature': assinar(corpo) } });
assert.equal(r.status, 200, JSON.stringify(r.json));
assert.match(r.json.resultado, /emitida/);
const reg = memoria.get(`farol/licencas/sessao-${sessaoId}.json`);
assert.ok(reg.chave.startsWith('FAROL-'));
assert.equal(reg.licenca.cliente, 'Empresa Teste Ltda');
assert.equal(reg.licenca.dispositivos_max, 20);
// a assinatura confere com o par de teste (a mesma lógica do servidor)
const [p, s] = reg.chave.slice(6).split('.');
assert.equal(verify(null, Buffer.from(p, 'base64url'), par.publicKey, Buffer.from(s, 'base64url')), true);
// idempotência
r = await chamar(webhook, { metodo: 'POST', bruto: corpo, headers: { 'stripe-signature': assinar(corpo) } });
assert.match(r.json.resultado, /já emitida/);
// sessão não paga é ignorada
const naoPaga = evento('checkout.session.completed', { ...sessao, id: 'cs_test_naopaga0123456789ABCD', payment_status: 'unpaid' });
r = await chamar(webhook, { metodo: 'POST', bruto: naoPaga, headers: { 'stripe-signature': assinar(naoPaga) } });
assert.match(r.json.resultado, /ignorado/);
assert.equal(memoria.has('farol/licencas/sessao-cs_test_naopaga0123456789ABCD.json'), false);
// metadata adulterada (dispositivos absurdos) falha sem emitir
const ruim = evento('checkout.session.completed', { ...sessao, id: 'cs_test_ruim0123456789ABCDEFG', metadata: { dispositivos: '99999' } });
r = await chamar(webhook, { metodo: 'POST', bruto: ruim, headers: { 'stripe-signature': assinar(ruim) } });
assert.equal(r.status, 500);
console.log('ok webhook');

// renovação (invoice.paid)
const fim = Math.floor(Date.now() / 1000) + 60 * 86400;
const fatura = evento('invoice.paid', { billing_reason: 'subscription_cycle', subscription: sessao.subscription, lines: { data: [{ period: { end: fim } }] } });
r = await chamar(webhook, { metodo: 'POST', bruto: fatura, headers: { 'stripe-signature': assinar(fatura) } });
assert.match(r.json.resultado, /renovada/);
const reg2 = memoria.get(`farol/licencas/sessao-${sessaoId}.json`);
assert.equal(reg2.licenca.expira_em, fim * 1000);
assert.equal(reg2.licenca.id, reg.licenca.id);
assert.notEqual(reg2.chave, reg.chave);
const primeira = evento('invoice.paid', { billing_reason: 'subscription_create', subscription: sessao.subscription });
r = await chamar(webhook, { metodo: 'POST', bruto: primeira, headers: { 'stripe-signature': assinar(primeira) } });
assert.match(r.json.resultado, /ignorado/);
console.log('ok renovacao');

// licença por sessão
novoIp();
r = await chamar(licenca, { url: `/api/licenca?session_id=${sessaoId}` });
assert.equal(r.status, 200); assert.equal(r.json.chave, reg2.chave); assert.equal(r.json.dispositivos_max, 20);
assert.deepEqual(Object.keys(r.json).sort(), ['chave', 'cliente', 'dispositivos_max', 'emitida_em', 'expira_em', 'intervalo', 'plano'], 'só expõe a licença');
assert.equal((await chamar(licenca, { url: '/api/licenca?session_id=cs_test_naoexiste0123456789ABC' })).status, 202);
assert.equal((await chamar(licenca, { url: '/api/licenca?session_id=../../etc/passwd' })).status, 400);
assert.equal((await chamar(licenca, { url: '/api/licenca' })).status, 400);
assert.equal((await chamar(licenca, { url: `/api/licenca?session_id=${sessaoId}`, metodo: 'POST' })).status, 405);
console.log('ok licenca por sessao');

globalThis.fetch = fetchReal;
console.log('\nTodos os testes das funções passaram.');
