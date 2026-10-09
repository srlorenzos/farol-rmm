// Moldura do console: barra lateral (seções, ícones, recolhível), topo (escopo cliente/site, busca global,
// tema, notificações, usuário). Os itens vêm do registro — o shell não conhece nenhum módulo.
import { h, limpar, preencher, lerPreferencia, salvarPreferencia } from './dom.js';
import { icone, logo } from './icones.js';
import { estado, aoEvento, definirEscopo, pode } from './estado.js';
import { registro, visiveis, secoesMenu } from './registro.js';
import { get } from './api.js';
import { iniciais, relativo, fmtInt } from './formato.js';
import { abrirMenu, botaoMenu } from '../ui/flutuante.js';
import { botaoIcone } from '../ui/componentes.js';
import { abrirPaleta } from './paleta.js';

export const PAPEIS = { admin: 'Administrador', tecnico: 'Técnico', leitura: 'Somente leitura' };

// ---------------------------------------------------------------- tema
export function temaAtual() { return document.documentElement.dataset.theme === 'light' ? 'claro' : 'escuro'; }
export function definirTema(tema) {
  document.documentElement.dataset.theme = tema === 'claro' ? 'light' : 'dark';
  salvarPreferencia('tema', tema);
}

let conteudo;
let nav;

/** Monta o shell e devolve o <main> onde as páginas são renderizadas. */
export function montarShell(raiz, { sair }) {
  if (lerPreferencia('lateral-recolhida', false)) document.body.classList.add('lateral-recolhida');
  nav = h('nav', { class: 'lateral-nav', 'aria-label': 'Navegação principal' });
  const conexao = h('span', { class: ['conexao', estado.conectado && 'conectado'] }, h('span', { class: 'conexao-ponto', 'aria-hidden': 'true' }),
    h('span', { class: 'conexao-texto', text: estado.conectado ? 'Tempo real' : 'Conectando…' }));
  const recolher = botaoIcone('recolher', 'Recolher menu', {
    classe: 'lateral-recolher', onclick: () => {
      const r = document.body.classList.toggle('lateral-recolhida');
      salvarPreferencia('lateral-recolhida', r);
      recolher.setAttribute('aria-label', r ? 'Expandir menu' : 'Recolher menu');
      recolher.dataset.dica = r ? 'Expandir menu' : 'Recolher menu';
    },
  });
  const lateral = h('aside', { class: 'lateral', id: 'lateral' },
    h('a', { class: 'lateral-marca', href: '#/' }, logo(), h('span', { class: 'marca-texto' }, 'Farol'), h('span', { class: 'marca-versao', text: `v${estado.versao.split('.')[0] || '2'}` })),
    nav,
    h('div', { class: 'lateral-rodape' }, conexao, recolher));

  const botaoMenuMovel = botaoIcone('menu', 'Abrir menu', { classe: 'botao-menu' });
  botaoMenuMovel.setAttribute('aria-controls', 'lateral');
  botaoMenuMovel.setAttribute('aria-expanded', 'false');
  const fecharMenuMovel = () => { document.body.classList.remove('menu-aberto'); botaoMenuMovel.setAttribute('aria-expanded', 'false'); };
  botaoMenuMovel.addEventListener('click', () => {
    const a = document.body.classList.toggle('menu-aberto');
    botaoMenuMovel.setAttribute('aria-expanded', String(a));
  });
  nav.addEventListener('click', (ev) => { if (ev.target.closest('a')) fecharMenuMovel(); });

  const atalho = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘K' : 'Ctrl K';
  const busca = h('button', { class: 'busca-global', type: 'button', onclick: () => abrirPaleta(), 'aria-label': `Buscar e executar comandos (${atalho})` },
    icone('busca', { tamanho: 16 }), h('span', { text: 'Buscar dispositivos, scripts, páginas…' }), h('kbd', { text: atalho }));

  const tema = botaoIcone(temaAtual() === 'claro' ? 'lua' : 'sol', temaAtual() === 'claro' ? 'Usar tema escuro' : 'Usar tema claro', { classe: 'so-largo' });
  tema.addEventListener('click', () => {
    definirTema(temaAtual() === 'claro' ? 'escuro' : 'claro');
    preencher(tema, icone(temaAtual() === 'claro' ? 'lua' : 'sol'));
    const r = temaAtual() === 'claro' ? 'Usar tema escuro' : 'Usar tema claro';
    tema.setAttribute('aria-label', r); tema.dataset.dica = r;
  });

  const topo = h('header', { class: 'topo' },
    botaoMenuMovel, seletorEscopo(), busca, h('div', { class: 'topo-espaco' }),
    h('div', { class: 'topo-acoes' }, tema, sino(), menuUsuario(sair)));

  conteudo = h('main', { class: 'conteudo', id: 'conteudo', tabindex: -1 });
  limpar(raiz);
  raiz.append(
    h('a', { class: 'pular', href: '#conteudo', onclick: (ev) => { ev.preventDefault(); conteudo.focus(); } }, 'Pular para o conteúdo'),
    lateral, h('div', { class: 'cortina-menu', onclick: fecharMenuMovel }),
    h('div', { class: 'principal' }, topo, conteudo));

  desenharMenu();
  aoEvento('conexao', (ok) => {
    conexao.classList.toggle('conectado', ok);
    conexao.querySelector('.conexao-texto').textContent = ok ? 'Tempo real' : 'Reconectando…';
    conexao.dataset.dica = ok ? 'Atualização ao vivo ativa' : 'Sem conexão em tempo real; tentando de novo';
  });
  aoEvento('contadores', desenharMenu);
  return conteudo;
}

// ---------------------------------------------------------------- menu lateral
export function desenharMenu(ativo = nav?.dataset.ativo) {
  if (!nav) return;
  nav.dataset.ativo = ativo ?? '';
  const itens = visiveis(registro.menu);
  preencher(nav, secoesMenu().map((secao) => h('div', { class: 'nav-secao' },
    h('div', { class: 'nav-secao-titulo', text: secao }),
    itens.filter((m) => m.secao === secao).map((m) => {
      const n = m.contador?.() ?? 0;
      return h('a', { class: 'nav-item', href: m.href, 'aria-current': m.id === ativo ? 'page' : null, 'data-dica': document.body.classList.contains('lateral-recolhida') ? m.rotulo : null },
        icone(m.icone), h('span', { class: 'nav-rotulo', text: m.rotulo }),
        n ? h('span', { class: 'nav-contador', 'aria-label': `${n} pendentes`, text: n > 99 ? '99+' : String(n) }) : null);
    }))));
}

// ---------------------------------------------------------------- escopo cliente/site
function rotuloEscopo() {
  const e = estado.escopo;
  for (const c of estado.clientes) {
    if (e.cliente === c.id) return { tipo: 'Cliente', nome: c.nome };
    const s = c.sites.find((x) => x.id === e.site);
    if (s) return { tipo: c.nome, nome: s.nome };
  }
  return { tipo: 'Escopo', nome: 'Todos os clientes' };
}

function seletorEscopo() {
  const botao = h('button', { class: 'seletor-escopo', type: 'button', 'aria-label': 'Escolher cliente ou site' });
  const desenhar = () => {
    const r = rotuloEscopo();
    preencher(botao, h('span', { class: 'escopo-icone', 'aria-hidden': 'true' }, icone(estado.escopo.site ? 'site' : 'predio')),
      h('span', { class: 'escopo-texto' }, h('small', { text: r.tipo }), h('span', { text: r.nome })), icone('chevron-baixo'));
  };
  const carregar = async () => {
    if (!pode('organizacao.ver')) return;
    try { estado.clientes = await get('/api/clientes'); } catch { estado.clientes = []; }
    desenhar();
  };
  botaoMenu(botao, () => {
    const total = estado.clientes.reduce((n, c) => n + c.dispositivos, 0);
    const itens = [{ titulo: 'Escopo' },
      { rotulo: 'Todos os clientes', icone: 'globo', marcado: !estado.escopo.cliente && !estado.escopo.site, atalho: fmtInt(total), onclick: () => definirEscopo({}) }];
    for (const c of estado.clientes) {
      itens.push('-', { rotulo: c.nome, icone: 'predio', marcado: estado.escopo.cliente === c.id, atalho: fmtInt(c.dispositivos), onclick: () => definirEscopo({ cliente: c.id }) });
      if (c.sites.length > 1) for (const s of c.sites) itens.push({ rotulo: s.nome, classe: 'site', icone: 'site', marcado: estado.escopo.site === s.id, atalho: fmtInt(s.dispositivos), onclick: () => definirEscopo({ site: s.id }) });
    }
    if (pode('organizacao.gerenciar')) itens.push('-', { rotulo: 'Gerenciar clientes e sites', icone: 'config', href: '#/configuracoes/organizacao' });
    return itens;
  }, { classe: 'escopo-arvore', rotulo: 'Clientes e sites' });
  desenhar();
  carregar();
  aoEvento('escopo', desenhar);
  aoEvento('organizacao', carregar);
  return botao;
}

// ---------------------------------------------------------------- notificações
function sino() {
  const contador = h('span', { class: 'ponto-contador', hidden: true });
  const botao = botaoIcone('alertas', 'Notificações', { contador });
  let total = 0;
  const fontes = () => visiveis(registro.notificacoes);
  const atualizar = async () => {
    const ns = await Promise.all(fontes().map((f) => f.contar().catch(() => 0)));
    total = ns.reduce((a, b) => a + b, 0);
    contador.hidden = !total;
    contador.textContent = total > 99 ? '99+' : String(total);
    botao.setAttribute('aria-label', total ? `Notificações: ${total} pendentes` : 'Notificações');
  };
  botaoMenu(botao, [], {
    alinhar: 'fim', rotulo: 'Notificações',
    conteudo: () => {
      const lista = h('div', { class: 'pilha-2' }, h('p', { class: 'sutil pequeno centro', text: 'Carregando…' }));
      Promise.all(fontes().map((f) => f.listar().then((itens) => itens.map((i) => ({ ...i, fonte: f }))).catch(() => []))).then((grupos) => {
        const itens = grupos.flat().sort((a, b) => (b.quando ?? 0) - (a.quando ?? 0)).slice(0, 8);
        preencher(lista, itens.length ? itens.map((n) => h('a', { class: 'menu-item', href: n.href ?? '#/', estilo: { alignItems: 'flex-start', padding: '8px 12px' } },
          h('span', { class: `severidade severidade-${n.tom ?? 'info'}` }, icone(n.icone ?? 'info')),
          h('span', { class: 'cresce' }, h('span', { class: 'forte', text: n.titulo }), h('br'), h('span', { class: 'sutil pequeno', text: `${n.texto ?? ''}${n.quando ? ` · ${relativo(n.quando)}` : ''}` }))))
          : h('div', { class: 'vazio compacto' }, h('p', { class: 'vazio-titulo', text: 'Tudo tranquilo' }), h('p', { text: 'Nenhuma notificação pendente.' })));
      });
      const verTodos = fontes()[0]?.href;
      return h('div', { estilo: { width: 'min(380px, calc(100vw - 24px))' } },
        h('div', { class: 'menu-cabecalho linha-entre' }, h('strong', { text: 'Notificações' }), total ? h('span', { class: 'selo selo-critico', text: `${total} abertos` }) : null),
        lista, verTodos ? h('div', { class: 'menu-sep' }) : null, verTodos ? h('a', { class: 'menu-item', href: verTodos }, icone('seta'), 'Ver todos os alertas') : null);
    },
  });
  setTimeout(() => {
    atualizar();
    const eventos = new Set(fontes().flatMap((f) => f.eventos));
    let t;
    for (const ev of eventos) aoEvento(ev, () => { clearTimeout(t); t = setTimeout(atualizar, 400); });
  });
  aoEvento('contadores', atualizar);
  return botao;
}

// ---------------------------------------------------------------- usuário
function menuUsuario(sair) {
  const botao = h('button', { class: 'btn-icone', type: 'button', 'aria-label': `Conta de ${estado.usuario}` },
    h('span', { class: 'avatar', 'aria-hidden': 'true', text: iniciais(estado.nome || estado.usuario) }));
  botaoMenu(botao, () => [
    { titulo: `${estado.nome || estado.usuario} · ${PAPEIS[estado.papel] ?? estado.papel}` },
    { rotulo: 'Minha conta e 2FA', icone: 'usuario', href: '#/configuracoes/conta' },
    { rotulo: temaAtual() === 'claro' ? 'Tema escuro' : 'Tema claro', icone: temaAtual() === 'claro' ? 'lua' : 'sol', onclick: () => { definirTema(temaAtual() === 'claro' ? 'escuro' : 'claro'); } },
    { rotulo: 'Paleta de comandos', icone: 'busca', atalho: 'Ctrl K', onclick: () => abrirPaleta() },
    '-',
    { rotulo: 'Sair', icone: 'sair', onclick: sair },
  ], { alinhar: 'fim', rotulo: 'Conta' });
  return botao;
}

export { abrirMenu };
