// Interações do site: tema, menu móvel, animações de entrada, preços/calculadora, compra e contato.
import { calcular, FAIXAS, GRATIS_MAX, MIN_PAGO, MAX_DISPOSITIVOS, NOMES_PLANO, brl, DESCONTO_ANUAL } from './precos.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const raiz = document.documentElement;

// ------------------------------------------------------------ tema
function aplicarTema(t) {
  raiz.setAttribute('data-theme', t);
  try { localStorage.setItem('farol-site-tema', t); } catch { /* sem armazenamento */ }
  $('meta[name="theme-color"]')?.setAttribute('content', t === 'light' ? '#f3f6f7' : '#081217');
}
$('[data-tema]')?.addEventListener('click', () => aplicarTema(raiz.getAttribute('data-theme') === 'light' ? 'dark' : 'light'));

// ------------------------------------------------------------ menu móvel
const botaoMenu = $('[data-menu]');
const menu = $('#menu-movel');
const fecharMenu = () => { menu?.classList.remove('aberto'); botaoMenu?.setAttribute('aria-expanded', 'false'); };
botaoMenu?.addEventListener('click', () => {
  const aberto = menu.classList.toggle('aberto');
  botaoMenu.setAttribute('aria-expanded', String(aberto));
});
menu?.addEventListener('click', (e) => { if (e.target.closest('a')) fecharMenu(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') fecharMenu(); });

// ------------------------------------------------------------ animações de entrada
const itens = $$('.revelar');
if ('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const obs = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('visto'); obs.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  itens.forEach((el, i) => { el.style.transitionDelay = `${(i % 3) * 70}ms`; obs.observe(el); });
} else itens.forEach((el) => el.classList.add('visto'));

// ------------------------------------------------------------ copiar comandos
$$('[data-copiar]').forEach((b) => b.addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(b.dataset.copiar); b.setAttribute('aria-label', 'Copiado'); setTimeout(() => b.setAttribute('aria-label', 'Copiar comandos'), 1800); } catch { /* sem permissão */ }
}));

// ------------------------------------------------------------ preços e calculadora
let ciclo = 'mes';
let compra = false;
let emailContato = 'lorenzoprofissional@gmail.com';
const num = $('#qtd-num');
const slider = $('#qtd-slider');
const msg = $('#calc-msg');
const quantidadeAtual = () => {
  const q = Math.floor(Number(num.value));
  return Number.isFinite(q) ? q : 0;
};

function desenharFaixas() {
  const corpo = $('#faixas');
  corpo.replaceChildren();
  const linhas = [[`Até ${GRATIS_MAX}`, 0], ...FAIXAS.map((f) => [`${f.de} a ${f.ate.toLocaleString('pt-BR')}`, f.mensal])];
  for (const [rotulo, mensal] of linhas) {
    const tr = document.createElement('tr');
    const a = document.createElement('td'); a.textContent = `${rotulo} dispositivos`;
    const b = document.createElement('td');
    const v = ciclo === 'ano' ? Math.round(mensal * (1 - DESCONTO_ANUAL)) : mensal;
    b.textContent = mensal === 0 ? 'Grátis' : brl(v);
    tr.append(a, b); corpo.append(tr);
  }
}

function desenharCartoes() {
  const f = (c) => (ciclo === 'ano' ? Math.round(c * (1 - DESCONTO_ANUAL)) : c);
  $('[data-preco="pro"]').textContent = brl(f(FAIXAS[0].mensal));
  $('[data-preco="msp"]').textContent = brl(f(FAIXAS.at(-1).mensal));
  const nota = ciclo === 'ano' ? 'Cobrança anual, já com 20% de desconto.' : 'Cobrança mensal.';
  $('[data-sub="pro"]').textContent = `De ${FAIXAS[0].de} a ${FAIXAS[0].ate} dispositivos. ${nota}`;
  $('[data-sub="msp"]').textContent = `De 51 a 5.000 dispositivos, em faixas. ${nota}`;
}

function desenharCalc() {
  const q = quantidadeAtual();
  slider.style.setProperty('--p', `${Math.min(100, (Math.min(q, 500) / 500) * 100)}%`);
  const invalido = q < 1 || q > MAX_DISPOSITIVOS;
  msg.textContent = invalido ? `Informe de 1 a ${MAX_DISPOSITIVOS.toLocaleString('pt-BR')} dispositivos.` : (q > 500 ? 'Acima de 500: o cálculo continua valendo, o controle só vai até 500.' : '');
  const cta = $('#res-cta');
  if (invalido) { $('#res-total').textContent = '--'; cta.setAttribute('aria-disabled', 'true'); return; }
  cta.removeAttribute('aria-disabled');
  const p = calcular(q, ciclo);
  $('#res-plano').textContent = NOMES_PLANO[p.plano];
  $('#res-qtd').textContent = q.toLocaleString('pt-BR');
  $('#res-total').textContent = brl(p.total);
  $('#res-periodo').textContent = ciclo === 'ano' ? '/ano' : '/mês';
  $('#res-medio').textContent = p.plano === 'gratis' ? 'Grátis' : brl(p.por_dispositivo_mes);
  if (ciclo === 'ano' && p.plano !== 'gratis') { $('#res-extra-rot').textContent = 'Economia vs. mensal'; $('#res-extra').textContent = `${brl(p.economia_anual)}/ano`; }
  else { $('#res-extra-rot').textContent = 'Equivale a'; $('#res-extra').textContent = p.plano === 'gratis' ? 'Sem custo' : `${brl(p.total * 12)}/ano`; }
  $('#res-nota').textContent = p.plano === 'gratis' ? 'Até 5 dispositivos não exige licença nem cartão.' : (compra ? 'Pagamento seguro pelo Stripe. A chave aparece logo após a aprovação.' : 'Fale com vendas para contratar. A licença é emitida por e-mail.');
  cta.textContent = p.plano === 'gratis' ? 'Baixar grátis' : (compra ? `Assinar ${NOMES_PLANO[p.plano]}` : 'Fale com vendas');
  cta.setAttribute('href', p.plano === 'gratis' ? '#baixar' : '#calculadora');
}

function definirQuantidade(q, origem) {
  const v = Math.max(1, Math.min(MAX_DISPOSITIVOS, Math.floor(q) || 1));
  if (origem !== 'num') num.value = String(v);
  if (origem !== 'slider') slider.value = String(Math.min(v, 500));
  desenharCalc();
}
slider.addEventListener('input', () => definirQuantidade(Number(slider.value), 'slider'));
num.addEventListener('input', () => { slider.value = String(Math.max(1, Math.min(500, quantidadeAtual() || 1))); desenharCalc(); });
num.addEventListener('blur', () => definirQuantidade(quantidadeAtual() || 1));

$$('[data-ciclo]').forEach((b) => b.addEventListener('click', () => {
  ciclo = b.dataset.ciclo;
  $$('[data-ciclo]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  desenharFaixas(); desenharCartoes(); desenharCalc();
}));
$$('[data-plano]').forEach((b) => b.addEventListener('click', () => {
  definirQuantidade(Number(b.dataset.plano));
  $('#calculadora').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
}));

// ------------------------------------------------------------ compra (Stripe) ou "Fale com vendas"
const dlg = $('#dlg-contato');
const form = $('#form-contato');
let ultimoFoco = null;

function abrirContato({ dispositivos, mensagem, titulo = 'Fale com vendas', sub = 'Conte o que você precisa e respondemos por e-mail.' } = {}) {
  ultimoFoco = document.activeElement;
  $('#dlg-titulo').textContent = titulo;
  $('#dlg-sub').textContent = sub;
  $('#c-erro').hidden = true; $('#c-ok').hidden = true;
  if (dispositivos) $('#c-disp').value = String(dispositivos);
  if (mensagem) $('#c-msg').value = mensagem;
  if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
  $('#c-nome').focus();
}
$$('[data-vendas]').forEach((b) => b.addEventListener('click', () => abrirContato()));
$('[data-fechar]').addEventListener('click', () => dlg.close());
dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
dlg.addEventListener('close', () => ultimoFoco?.focus?.());

async function iniciarCheckout(q) {
  const cta = $('#res-cta');
  const original = cta.textContent;
  cta.setAttribute('aria-disabled', 'true'); cta.textContent = 'Abrindo o pagamento...';
  try {
    const r = await fetch('/api/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dispositivos: q, intervalo: ciclo }) });
    const j = await r.json().catch(() => ({}));
    if (r.ok && j.url) { location.assign(j.url); return; }
    if (j.vendas) { compra = false; desenharCalc(); abrirContato({ dispositivos: q, mensagem: textoPedido(q) }); return; }
    msg.textContent = j.erro || 'Não foi possível iniciar o pagamento agora.';
  } catch { msg.textContent = 'Sem conexão. Tente novamente.'; }
  cta.removeAttribute('aria-disabled'); cta.textContent = original;
}
const textoPedido = (q) => { const p = calcular(q, ciclo); return `Quero contratar o plano ${NOMES_PLANO[p.plano]} para ${q} dispositivos (${ciclo === 'ano' ? 'anual' : 'mensal'}, ${brl(p.total)}).`; };

$('#res-cta').addEventListener('click', (e) => {
  const q = quantidadeAtual();
  if (q < 1 || q > MAX_DISPOSITIVOS) { e.preventDefault(); num.focus(); return; }
  if (q <= GRATIS_MAX) return; // segue o link #baixar
  e.preventDefault();
  if (e.currentTarget.getAttribute('aria-disabled') === 'true') return;
  if (q < MIN_PAGO) return;
  if (compra) iniciarCheckout(q);
  else abrirContato({ dispositivos: q, mensagem: textoPedido(q), titulo: 'Fale com vendas', sub: 'A compra online ainda não está ativa. Deixe seu contato e enviamos a licença.' });
});

const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const erro = $('#c-erro'); const ok = $('#c-ok'); const botao = $('#c-enviar');
  erro.hidden = true; ok.hidden = true;
  const dados = Object.fromEntries(new FormData(form).entries());
  if (!dados.nome?.trim()) { erro.textContent = 'Informe seu nome.'; erro.hidden = false; $('#c-nome').focus(); return; }
  if (!EMAIL.test(String(dados.email || '').trim())) { erro.textContent = 'Informe um e-mail válido.'; erro.hidden = false; $('#c-email').focus(); return; }
  const carga = { ...dados, dispositivos: dados.dispositivos ? Number(dados.dispositivos) : null };
  botao.disabled = true; botao.textContent = 'Enviando...';
  try {
    const r = await fetch('/api/contato', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(carga) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.erro || 'Não foi possível enviar agora.');
    if (j.salvo === false) {
      // Sem armazenamento no servidor: abre o e-mail do usuário com a mensagem pronta.
      const corpo = `Nome: ${carga.nome}\nE-mail: ${carga.email}\nEmpresa: ${carga.empresa || '-'}\nDispositivos: ${carga.dispositivos ?? '-'}\n\n${carga.mensagem || ''}`;
      ok.textContent = 'Abrimos o seu aplicativo de e-mail com a mensagem pronta. É só enviar.'; ok.hidden = false;
      location.href = `mailto:${emailContato}?subject=${encodeURIComponent('Farol RMM: contato comercial')}&body=${encodeURIComponent(corpo)}`;
    } else {
      ok.textContent = 'Recebemos o seu contato. Respondemos por e-mail em breve.'; ok.hidden = false; form.reset();
    }
  } catch (err) { erro.textContent = err.message; erro.hidden = false; }
  botao.disabled = false; botao.textContent = 'Enviar';
});

// ------------------------------------------------------------ inicialização
desenharFaixas(); desenharCartoes(); desenharCalc();
fetch('/api/config').then((r) => (r.ok ? r.json() : null)).then((c) => {
  if (!c) return;
  compra = !!c.compra; if (c.email) emailContato = c.email;
  desenharCalc();
}).catch(() => { /* sem API: segue em "Fale com vendas" */ });
