// Lista de chamados (página própria, com filtros e ações em massa) e a versão compacta usada na aba
// "Chamados" do detalhe do dispositivo (mesmas colunas, sem a coluna Dispositivo, já filtrada por agente).
import { h, preencher, debounce } from '../../nucleo/dom.js';
import { get, put, qs } from '../../nucleo/api.js';
import { aoEvento, paramsEscopo, pode } from '../../nucleo/estado.js';
import { relativo, fmtData, fmtInt, normalizar } from '../../nucleo/formato.js';
import { icone } from '../../nucleo/icones.js';
import { cabecalhoPagina, chipsFiltro, busca, select, selo, vazio, skeleton, botao } from '../../ui/componentes.js';
import { tabelaVirtual } from '../../ui/tabela-virtual.js';
import { toast, toastErro } from '../../ui/camadas.js';
import { STATUS, PRIORIDADES, NOMES_STATUS, NOMES_PRIORIDADE, NOMES_CATEGORIA, seloStatus, seloPrioridade, atualizarContadorChamados } from './index.js';

function colunas({ comDispositivo = true } = {}) {
  return [
    { id: 'prio', rotulo: 'Prioridade', largura: '112px', render: (c) => seloPrioridade(c.prioridade), valor: (c) => ({ urgente: 0, alta: 1, normal: 2, baixa: 3 }[c.prioridade]) },
    ...(comDispositivo ? [{ id: 'disp', rotulo: 'Dispositivo', largura: 'minmax(140px, 1fr)', render: (c) => h('div', { class: 'celula-duas-linhas' },
      h('a', { class: 'forte', href: `#/dispositivos/${c.agente_id}?aba=chamados`, text: c.hostname, onclick: (ev) => ev.stopPropagation() }), h('span', { class: 'sutil pequeno', text: c.site_nome })), valor: (c) => c.hostname }] : []),
    { id: 'assunto', rotulo: 'Assunto', largura: 'minmax(220px, 2fr)', render: (c) => h('span', { title: c.assunto, text: c.assunto }), valor: (c) => c.assunto },
    { id: 'cat', rotulo: 'Categoria', largura: '120px', render: (c) => selo(NOMES_CATEGORIA[c.categoria] ?? c.categoria, 'neutro'), valor: (c) => c.categoria },
    { id: 'status', rotulo: 'Status', largura: '175px', render: (c) => seloStatus(c.status), valor: (c) => STATUS.indexOf(c.status) },
    { id: 'tecnico', rotulo: 'Técnico', largura: '120px', render: (c) => c.tecnico ? h('span', { text: c.tecnico }) : h('span', { class: 'sutil', text: '—' }), valor: (c) => c.tecnico },
    { id: 'quando', rotulo: 'Atualizado', largura: '130px', render: (c) => h('span', { class: 'muted', title: fmtData(c.atualizado_em), text: relativo(c.atualizado_em) }), valor: (c) => -c.atualizado_em },
  ];
}

/** Troca status/prioridade de vários chamados de uma vez (PUT direto, sem registrar mensagem). */
async function aplicarEmMassa(ids, corpo) {
  let ok = 0;
  for (const id of ids) {
    try { await put(`/api/chamados/${id}`, corpo); ok++; } catch (e) { if (ids.length === 1) toastErro(e); }
  }
  return ok;
}

export function paginaChamados(raiz, { query }) {
  let status = query.get('status') || 'abertos';
  let prioridade = query.get('prioridade') || '';
  let texto = '';
  let lista = [];
  const barraLote = h('div', { class: 'barra-lote', hidden: true, role: 'region', 'aria-label': 'Ações em massa' });
  const tabela = tabelaVirtual({
    rotulo: 'Chamados', chave: (c) => c.id, colunas: colunas(), selecionavel: pode('chamados.responder'),
    ordem: { coluna: 'prio', direcao: 'asc' },
    aoAbrir: (c) => { location.hash = `#/chamados/${c.id}`; },
    aoSelecionar: (sel) => {
      barraLote.hidden = !sel.size;
      const idsSelecionados = tabela.selecionadas().map((c) => c.id);
      const selStatus = select(STATUS.map((s) => [s, NOMES_STATUS[s]]), '', { rotulo: 'Novo status' });
      preencher(barraLote, h('span', { class: 'contagem', text: `${fmtInt(sel.size)} selecionado(s)` }), h('span', { class: 'sep' }),
        selStatus,
        botao('Aplicar', { icone: 'check', tamanho: 'pequeno', variante: 'primario', onclick: async () => {
          if (!selStatus.value) return;
          const n = await aplicarEmMassa(idsSelecionados, { status: selStatus.value });
          if (n) toast(`${n} chamado(s) atualizado(s).`, 'sucesso');
          tabela.limparSelecao(); carregar();
        } }),
        h('button', { class: 'btn-icone pequeno', 'aria-label': 'Limpar seleção', onclick: () => tabela.limparSelecao() }, icone('fechar')));
    },
    vazio: () => (status === 'abertos' && !texto && !prioridade
      ? vazio({ titulo: 'Nenhum chamado aberto', texto: 'Os chamados abertos pela bandeja do agente aparecem aqui.', ilustracao: 'tudo-ok' })
      : vazio({ titulo: 'Nenhum chamado encontrado', texto: 'Ajuste os filtros.', ilustracao: 'busca', compacto: true })),
  });
  const campoBusca = busca('Buscar dispositivo ou assunto…', { classe: 'cresce' });
  campoBusca.input.addEventListener('input', debounce(() => { texto = campoBusca.input.value; aplicar(); }, 120));
  const chipsStatus = chipsFiltro(
    [{ id: 'abertos', rotulo: 'Abertos' }, { id: 'aguardando_usuario', rotulo: 'Aguardando você' }, { id: 'resolvido', rotulo: 'Resolvidos' }, { id: 'fechado', rotulo: 'Fechados' }, { id: 'todos', rotulo: 'Todos' }],
    status, (v) => { status = v || 'todos'; carregar(); }, { rotulo: 'Estado' });
  const chipsPrioridade = chipsFiltro(PRIORIDADES.map((p) => ({ id: p, rotulo: NOMES_PRIORIDADE[p] })), prioridade, (v) => { prioridade = v; aplicar(); }, { rotulo: 'Prioridade' });
  const corpo = h('div', {}, skeleton(6));
  raiz.append(
    cabecalhoPagina({ titulo: 'Chamados', migalhas: [['Gerenciar'], ['Chamados']], subtitulo: 'Suporte aberto pelos usuários na bandeja do agente.' }),
    h('section', { class: 'cartao' }, h('div', { class: 'ferramentas' }, campoBusca.el, h('span', { class: 'espaco' }), chipsStatus, chipsPrioridade), corpo),
    barraLote);

  const aplicar = () => {
    const t = normalizar(texto).split(/\s+/).filter(Boolean);
    tabela.definirLinhas(lista.filter((c) => (!prioridade || c.prioridade === prioridade)
      && t.every((x) => normalizar(`${c.hostname} ${c.assunto}`).includes(x))));
  };
  let primeira = true;
  async function carregar() {
    try {
      lista = await get(`/api/chamados${qs({ status, ...paramsEscopo() })}`);
      if (primeira) { preencher(corpo, tabela.el); primeira = false; }
      aplicar();
    } catch (e) { toastErro(e); }
  }
  carregar();
  const recarregar = debounce(() => { carregar(); atualizarContadorChamados(); }, 400);
  return aoEvento('chamado', recarregar);
}

export function abaChamadosDispositivo(el, { agente }) {
  const tabela = tabelaVirtual({
    rotulo: 'Chamados do dispositivo', chave: (c) => c.id, colunas: colunas({ comDispositivo: false }), ordem: { coluna: 'quando', direcao: 'asc' },
    aoAbrir: (c) => { location.hash = `#/chamados/${c.id}`; },
    vazio: () => vazio({ titulo: 'Nenhum chamado deste dispositivo', texto: 'Chamados abertos pela bandeja neste computador aparecem aqui.', ilustracao: 'tudo-ok', compacto: true }),
  });
  el.append(h('section', { class: 'cartao' }, tabela.el));
  const carregar = async () => { try { tabela.definirLinhas(await get(`/api/chamados?agente=${agente.id}&status=todos&limite=500`)); } catch (e) { toastErro(e); } };
  carregar();
  return aoEvento('chamado', (c) => { if (c.agente_id === agente.id) carregar(); });
}
