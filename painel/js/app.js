// Ponto de entrada do painel: autenticação, roteamento por hash, tema e tempo real.
import { h, icone, limpar, preencher, lerPreferencia, salvarPreferencia } from './util.js';
import { get, post, definirAoNaoAutenticado } from './api.js';
import { estado, aoEvento, conectarTempoReal, desconectarTempoReal } from './estado.js';
import { toast } from './ui.js';
import { telaLogin, logo } from './paginas/login.js';
import * as visao from './paginas/visao.js';
import * as agentes from './paginas/agentes.js';
import * as agente from './paginas/agente.js';
import * as scripts from './paginas/scripts.js';
import * as alertas from './paginas/alertas.js';
import * as auditoria from './paginas/auditoria.js';
import * as config from './paginas/config.js';

const raiz = document.getElementById('app');

const ROTAS = [
  { padrao: /^\/$/, pagina: visao, titulo: 'Visão geral', menu: 'visao' },
  { padrao: /^\/agentes$/, pagina: agentes, titulo: 'Agentes', menu: 'agentes' },
  { padrao: /^\/agentes\/(?<id>[0-9a-f-]{36})$/, pagina: agente, titulo: 'Agente', menu: 'agentes' },
  { padrao: /^\/scripts(?:\/(?<id>\d+|novo))?$/, pagina: scripts, titulo: 'Scripts', menu: 'scripts' },
  { padrao: /^\/alertas$/, pagina: alertas, titulo: 'Alertas', menu: 'alertas' },
  { padrao: /^\/auditoria$/, pagina: auditoria, titulo: 'Auditoria', menu: 'auditoria' },
  { padrao: /^\/config$/, pagina: config, titulo: 'Configurações', menu: 'config' },
];

const MENU = [
  ['visao', 'Visão geral', '#/'],
  ['agentes', 'Agentes', '#/agentes'],
  ['scripts', 'Scripts', '#/scripts'],
  ['alertas', 'Alertas', '#/alertas'],
  ['auditoria', 'Auditoria', '#/auditoria'],
  ['config', 'Configurações', '#/config'],
];

// ---------- Tema ----------
function temaAtual() {
  const salvo = lerPreferencia('farol-tema');
  if (salvo === 'claro' || salvo === 'escuro') return salvo;
  return matchMedia('(prefers-color-scheme: light)').matches ? 'claro' : 'escuro';
}
function aplicarTema(tema) {
  document.documentElement.dataset.theme = tema === 'claro' ? 'light' : 'dark';
}
aplicarTema(temaAtual());

// ---------- Layout ----------
let conteudo = null;
let navegacao = null;
let badgeAlertas = null;
let indicadorConexao = null;
let limparPagina = null;

function montarLayout() {
  limpar(raiz);
  badgeAlertas = h('span', { class: 'badge', hidden: true, 'aria-label': 'alertas abertos' });
  indicadorConexao = h('span', { class: 'conexao', title: 'Tempo real' }, h('span', { class: 'conexao-ponto' }), h('span', { class: 'conexao-texto', text: 'Conectando…' }));
  navegacao = h('nav', { class: 'menu', 'aria-label': 'Principal' }, h('ul', {}, MENU.map(([chave, rotulo, href]) => h('li', {},
    h('a', { class: 'menu-item', href, dataset: { menu: chave } }, icone(chave), h('span', { text: rotulo }), chave === 'alertas' ? badgeAlertas : null)))));

  const botaoTema = h('button', { class: 'btn-icone', type: 'button' });
  const desenharBotaoTema = () => {
    const claro = document.documentElement.dataset.theme === 'light';
    preencher(botaoTema, icone(claro ? 'lua' : 'sol'));
    botaoTema.setAttribute('aria-label', claro ? 'Usar tema escuro' : 'Usar tema claro');
    botaoTema.title = botaoTema.getAttribute('aria-label');
  };
  botaoTema.addEventListener('click', () => {
    const novo = document.documentElement.dataset.theme === 'light' ? 'escuro' : 'claro';
    salvarPreferencia('farol-tema', novo);
    aplicarTema(novo);
    desenharBotaoTema();
  });
  desenharBotaoTema();

  const lateral = h('aside', { class: 'lateral', id: 'lateral' },
    h('a', { class: 'marca', href: '#/' }, logo(), h('span', {}, 'Farol', h('b', {}, ' RMM'))),
    navegacao,
    h('div', { class: 'lateral-rodape' },
      indicadorConexao,
      h('div', { class: 'usuario-linha' },
        h('span', { class: 'usuario-nome', text: estado.usuario }),
        botaoTema,
        h('button', { class: 'btn-icone', type: 'button', 'aria-label': 'Sair', title: 'Sair', onclick: sair }, icone('sair')))));

  const botaoMenu = h('button', { class: 'btn-icone botao-menu', type: 'button', 'aria-label': 'Abrir menu', 'aria-expanded': 'false', 'aria-controls': 'lateral' }, icone('menu'));
  const fecharMenu = () => { document.body.classList.remove('menu-aberto'); botaoMenu.setAttribute('aria-expanded', 'false'); };
  botaoMenu.addEventListener('click', () => {
    const aberto = document.body.classList.toggle('menu-aberto');
    botaoMenu.setAttribute('aria-expanded', String(aberto));
  });
  navegacao.addEventListener('click', fecharMenu);
  const cortina = h('div', { class: 'cortina', onclick: fecharMenu });

  conteudo = h('main', { class: 'conteudo', id: 'conteudo', tabindex: -1 });
  raiz.append(
    h('a', { class: 'pular', href: '#conteudo', onclick: (ev) => { ev.preventDefault(); conteudo.focus(); } }, 'Pular para o conteúdo'),
    h('header', { class: 'topo-movel' }, botaoMenu, h('a', { class: 'marca', href: '#/' }, logo(), h('span', {}, 'Farol', h('b', {}, ' RMM')))),
    lateral, cortina, conteudo);
}

function atualizarBadge(n) {
  estado.alertasAbertos = n;
  if (!badgeAlertas) return;
  badgeAlertas.hidden = !n;
  badgeAlertas.textContent = n > 99 ? '99+' : String(n);
}

async function sincronizarBadge() {
  try { atualizarBadge((await get('/api/alertas?status=aberto')).length); } catch { /* ignora */ }
}

// ---------- Roteamento ----------
function rotear() {
  if (!conteudo) return;
  const [caminho, busca = ''] = (location.hash.slice(1) || '/').split('?');
  const rota = ROTAS.find((r) => r.padrao.test(caminho));
  limparPagina?.();
  limparPagina = null;
  limpar(conteudo);
  navegacao.querySelectorAll('.menu-item').forEach((a) => {
    const ativo = rota && a.dataset.menu === rota.menu;
    a.classList.toggle('ativo', ativo);
    if (ativo) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  if (!rota) {
    conteudo.append(h('div', { class: 'vazio' }, h('p', { class: 'vazio-titulo', text: 'Página não encontrada' }), h('a', { class: 'btn', href: '#/' }, 'Ir para a visão geral')));
    return;
  }
  document.title = `${rota.titulo} · Farol RMM`;
  const params = caminho.match(rota.padrao).groups || {};
  const pagina = h('div', { class: 'pagina' });
  conteudo.append(pagina);
  limparPagina = rota.pagina.render(pagina, { params, query: new URLSearchParams(busca) }) || null;
  conteudo.scrollTop = 0;
  window.scrollTo(0, 0);
}

// ---------- Sessão ----------
async function sair() {
  try { await post('/api/logout'); } catch { /* sessão já pode ter expirado */ }
  desconectarTempoReal();
  iniciar();
}

let avisouSessao = false;
definirAoNaoAutenticado(() => {
  if (avisouSessao) return;
  avisouSessao = true;
  toast('Sua sessão expirou. Entre novamente.', 'erro');
  desconectarTempoReal();
  iniciar();
});

async function iniciar() {
  limparPagina?.();
  limparPagina = null;
  conteudo = null;
  let e;
  try {
    e = await get('/api/estado');
  } catch {
    preencher(raiz, h('main', { class: 'tela-login' }, h('div', { class: 'cartao-login' },
      h('h1', { text: 'Servidor indisponível' }), h('p', { class: 'muted', text: 'Não foi possível falar com o servidor do Farol.' }),
      h('button', { class: 'btn btn-primario', onclick: iniciar }, 'Tentar de novo'))));
    return;
  }
  if (!e.autenticado) {
    limpar(raiz);
    document.title = 'Entrar · Farol RMM';
    telaLogin(raiz, { precisaSetup: e.precisaSetup, aoEntrar: iniciar });
    return;
  }
  avisouSessao = false;
  Object.assign(estado, { usuario: e.usuario, totpAtivo: e.totpAtivo, elevadoAte: e.elevadoAte });
  montarLayout();
  rotear();
  conectarTempoReal();
  sincronizarBadge();
}

window.addEventListener('hashchange', rotear);

aoEvento('conexao', (ok) => {
  if (!indicadorConexao) return;
  indicadorConexao.classList.toggle('conectado', ok);
  indicadorConexao.querySelector('.conexao-texto').textContent = ok ? 'Tempo real ativo' : 'Reconectando…';
});
aoEvento('alerta', (a) => {
  sincronizarBadge();
  if (a.status === 'aberto') toast(`Alerta: ${a.hostname ?? 'agente'} — ${a.mensagem}`, 'erro', 7000);
});
aoEvento('agente', (a) => {
  if (a.novo) toast(`Novo agente registrado: ${a.hostname}`, 'sucesso');
});

iniciar();
