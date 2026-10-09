// Lista de dispositivos: tabela virtual com filtros rápidos, busca, colunas configuráveis, agrupamento por site,
// seleção múltipla com ações em massa e atualização ao vivo.
import { h, preencher, debounce, lerPreferencia, salvarPreferencia } from '../../nucleo/dom.js';
import { icone } from '../../nucleo/icones.js';
import { aoEvento, estado } from '../../nucleo/estado.js';
import { registro, visiveis } from '../../nucleo/registro.js';
import { normalizar, fmtInt, soChave } from '../../nucleo/formato.js';
import { cabecalhoPagina, botao, busca, chipsFiltro, vazio, skeleton } from '../../ui/componentes.js';
import { tabelaVirtual } from '../../ui/tabela-virtual.js';
import { abrirMenu, botaoMenu } from '../../ui/flutuante.js';
import { toastErro } from '../../ui/camadas.js';
import { listarDispositivos, invalidarCache } from './comum.js';
import { adicionarDispositivo } from './instalar.js';
import { itensAcoes } from './acoes.js';

export function paginaLista(raiz, { query }) {
  let todos = [];
  let filtroRapido = query.get('filtro') || lerPreferencia('dispositivos.filtro', '') || '';
  let texto = query.get('q') || '';
  let agrupar = lerPreferencia('dispositivos.agrupar', false);
  const ocultas = new Set(lerPreferencia('dispositivos.colunas-ocultas', null)
    ?? registro.colunasDispositivo.filter((c) => c.padrao === false).map((c) => c.id));
  const subtitulo = h('p');
  const barraLote = h('div', { class: 'barra-lote', role: 'region', 'aria-label': 'Ações em massa', hidden: true });

  const colunasVisiveis = () => visiveis(registro.colunasDispositivo).filter((c) => !ocultas.has(c.id));
  const tabela = tabelaVirtual({
    rotulo: 'Dispositivos', colunas: colunasVisiveis(), chave: (a) => a.id, selecionavel: true,
    ordem: lerPreferencia('dispositivos.ordem', { coluna: 'dispositivo', direcao: 'asc' }),
    aoOrdenar: (o) => salvarPreferencia('dispositivos.ordem', o),
    agrupar: agrupar ? agrupamento : null,
    aoSelecionar: desenharLote,
    aoAbrir: (a) => { location.hash = `#/dispositivos/${a.id}`; },
    menu: (a, sel) => (sel.length > 1 ? itensLote(sel) : itensAcoes(a, { recarregar: carregar })),
    vazio: () => (todos.length
      ? vazio({ titulo: 'Nenhum dispositivo corresponde', texto: 'Ajuste a busca ou os filtros rápidos.', ilustracao: 'busca', compacto: true,
        acoes: [botao('Limpar filtros', { onclick: () => { filtroRapido = ''; texto = ''; campoBusca.input.value = ''; chips.atualizar(itensChips()); aplicar(); } })] })
      : vazio({ titulo: 'Nenhum dispositivo ainda', texto: 'Instale o agente do Farol nos computadores que você quer monitorar. Leva menos de um minuto.',
        acoes: [botao('Adicionar dispositivo', { variante: 'primario', icone: 'mais', onclick: adicionarDispositivo })] })),
  });
  function agrupamento(a) { return { chave: `${a.cliente_id}/${a.site_id}`, rotulo: `${a.cliente_nome} · ${a.site_nome}`, icone: 'site' }; }

  const campoBusca = busca('Buscar por nome, IP, usuário, SO…', { valor: texto, classe: 'cresce' });
  campoBusca.input.addEventListener('input', debounce(() => { texto = campoBusca.input.value; aplicar(); }, 120));

  const contagens = () => ({
    online: todos.filter((a) => a.status === 'online').length,
    offline: todos.filter((a) => a.status === 'offline').length,
    pendente: todos.filter((a) => a.status === 'pendente').length,
    alertas: todos.filter((a) => a.alertas_abertos > 0).length,
    windows: todos.filter((a) => soChave(a.so) === 'windows').length,
    linux: todos.filter((a) => soChave(a.so) === 'linux').length,
    macos: todos.filter((a) => soChave(a.so) === 'macos').length,
  });
  const itensChips = () => {
    const n = contagens();
    return [
      { id: 'online', rotulo: 'Online', n: n.online, ponto: 'ok' },
      { id: 'offline', rotulo: 'Offline', n: n.offline, ponto: '' },
      ...(n.pendente ? [{ id: 'pendente', rotulo: 'Aguardando', n: n.pendente, ponto: 'aviso' }] : []),
      { id: 'alertas', rotulo: 'Com alertas', n: n.alertas, icone: 'alertas' },
      { id: 'windows', rotulo: 'Windows', n: n.windows, icone: 'windows' },
      { id: 'linux', rotulo: 'Linux', n: n.linux, icone: 'linux' },
      ...(n.macos ? [{ id: 'macos', rotulo: 'macOS', n: n.macos, icone: 'apple' }] : []),
    ];
  };
  const chips = chipsFiltro(itensChips(), filtroRapido, (v) => { filtroRapido = v; salvarPreferencia('dispositivos.filtro', v); aplicar(); });

  const botaoColunas = botaoMenu(botao('Colunas', { icone: 'colunas', tamanho: 'pequeno' }), () => [
    { titulo: 'Colunas visíveis' },
    ...visiveis(registro.colunasDispositivo).filter((c) => c.rotulo && !c.fixa).map((c) => ({
      rotulo: c.rotulo, marcado: !ocultas.has(c.id), manterAberto: true,
      onclick: (ev) => {
        ocultas.has(c.id) ? ocultas.delete(c.id) : ocultas.add(c.id);
        salvarPreferencia('dispositivos.colunas-ocultas', [...ocultas]);
        ev.currentTarget.setAttribute('aria-checked', String(!ocultas.has(c.id)));
        tabela.definirColunas(colunasVisiveis());
      },
    })),
    '-', { rotulo: 'Restaurar padrão', icone: 'atualizar', onclick: () => {
      ocultas.clear(); registro.colunasDispositivo.filter((c) => c.padrao === false).forEach((c) => ocultas.add(c.id));
      salvarPreferencia('dispositivos.colunas-ocultas', null); tabela.definirColunas(colunasVisiveis());
    } },
  ], { alinhar: 'fim', rotulo: 'Colunas' });
  const botaoAgrupar = botao('Agrupar por site', { icone: 'site', tamanho: 'pequeno' });
  botaoAgrupar.setAttribute('aria-pressed', String(agrupar));
  botaoAgrupar.addEventListener('click', () => {
    agrupar = !agrupar;
    salvarPreferencia('dispositivos.agrupar', agrupar);
    botaoAgrupar.setAttribute('aria-pressed', String(agrupar));
    botaoAgrupar.classList.toggle('btn-ativo', agrupar);
    tabela.definirAgrupamento(agrupar ? agrupamento : null);
  });
  botaoAgrupar.classList.toggle('btn-ativo', agrupar);

  const corpoTabela = h('div', {}, skeleton(8));
  raiz.append(
    cabecalhoPagina({
      titulo: 'Dispositivos', migalhas: [['Gerenciar'], ['Dispositivos']],
      acoes: [botao('Adicionar dispositivo', { variante: 'primario', icone: 'mais', onclick: adicionarDispositivo })],
    }),
    h('section', { class: 'cartao' },
      h('div', { class: 'ferramentas' }, campoBusca.el, h('span', { class: 'espaco' }), botaoAgrupar, botaoColunas),
      h('div', { class: 'ferramentas' }, chips),
      corpoTabela),
    barraLote);
  raiz.querySelector('.pagina-cabecalho .titulo-bloco').append(subtitulo);

  function filtrar() {
    const termos = normalizar(texto).split(/\s+/).filter(Boolean);
    return todos.filter((a) => {
      if (filtroRapido === 'online' && a.status !== 'online') return false;
      if (filtroRapido === 'offline' && a.status !== 'offline') return false;
      if (filtroRapido === 'pendente' && a.status !== 'pendente') return false;
      if (filtroRapido === 'alertas' && !(a.alertas_abertos > 0)) return false;
      if (['windows', 'linux', 'macos'].includes(filtroRapido) && soChave(a.so) !== filtroRapido) return false;
      if (!termos.length) return true;
      const alvo = normalizar([a.hostname, a.descricao, a.ip_local, a.usuario_logado, a.so_versao, a.site_nome, a.cliente_nome].join(' '));
      return termos.every((t) => alvo.includes(t));
    });
  }

  function aplicar() {
    tabela.definirLinhas(filtrar());
  }

  function desenharSubtitulo() {
    const n = contagens();
    preencher(subtitulo, `${fmtInt(todos.length)} dispositivos · ${fmtInt(n.online)} online · ${fmtInt(n.offline)} offline`,
      estado.escopo.cliente || estado.escopo.site ? ' · escopo filtrado' : '');
  }

  function itensLote(sel) {
    return visiveis(registro.acoesLote).map((a) => ({ rotulo: a.rotulo, icone: a.icone, perigo: a.perigo, onclick: () => a.executar(sel, { recarregar: carregar }) }));
  }

  function desenharLote() {
    const sel = tabela.selecionadas();
    barraLote.hidden = !sel.length;
    if (!sel.length) return;
    const acoes = visiveis(registro.acoesLote);
    const principais = acoes.slice(0, 3);
    const extras = acoes.slice(3);
    preencher(barraLote,
      h('span', { class: 'contagem', text: `${fmtInt(sel.length)} selecionado(s)` }), h('span', { class: 'sep' }),
      principais.map((a) => botao(a.rotulo, { icone: a.icone, tamanho: 'pequeno', variante: a.primaria ? 'primario' : a.perigo ? 'perigo-sutil' : null,
        onclick: () => a.executar(tabela.selecionadas(), { recarregar: carregar }) })),
      extras.length ? botaoMenu(botao('Mais', { icone: 'reticencias', tamanho: 'pequeno' }), () => itensLote(tabela.selecionadas()), { lado: 'cima' }) : null,
      h('button', { class: 'btn-icone pequeno', 'aria-label': 'Limpar seleção', 'data-dica': 'Limpar seleção', onclick: () => tabela.limparSelecao() }, icone('fechar')));
  }

  let primeira = true;
  async function carregar() {
    try {
      todos = await listarDispositivos({ forcar: true });
      if (primeira) { preencher(corpoTabela, tabela.el); primeira = false; }
      chips.atualizar(itensChips());
      desenharSubtitulo();
      aplicar();
    } catch (e) { toastErro(e); }
  }
  carregar();

  const recarregar = debounce(() => { invalidarCache(); carregar(); }, 700);
  const cancelar = [
    aoEvento('checkin', (d) => {
      const a = todos.find((x) => x.id === d.id);
      if (!a) return recarregar();
      const mudouStatus = a.status !== d.status;
      Object.assign(a, d);
      if (mudouStatus) { chips.atualizar(itensChips()); desenharSubtitulo(); aplicar(); } else tabela.atualizarVisiveis();
    }),
    aoEvento('agente', recarregar),
    aoEvento('agente.canal', (d) => { const a = todos.find((x) => x.id === d.id); if (a) { a.tempo_real = d.conectado; tabela.atualizarVisiveis(); } }),
    aoEvento('alerta', recarregar),
  ];
  const relogio = setInterval(() => tabela.atualizarVisiveis(), 30_000); // "há x min"
  return () => { cancelar.forEach((c) => c()); clearInterval(relogio); recarregar.cancelar(); };
}

export { abrirMenu };
