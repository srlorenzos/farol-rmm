// Lista de políticas: cria/edita, aplica num alvo, mostra o histórico de aplicações e exclui.
import { h, preencher } from '../../nucleo/dom.js';
import { get, post, del } from '../../nucleo/api.js';
import { aoEvento, pode, estado } from '../../nucleo/estado.js';
import { fmtInt, relativo, fmtData } from '../../nucleo/formato.js';
import { cabecalhoPagina, botao, botaoIcone, selo, vazio, skeleton, select, campo, comCarregando } from '../../ui/componentes.js';
import { tabelaVirtual } from '../../ui/tabela-virtual.js';
import { botaoMenu } from '../../ui/flutuante.js';
import { modal, toast, toastErro, confirmar } from '../../ui/camadas.js';
import { comElevacao } from '../../ui/elevar.js';
import { abrirPoliticaModal } from './modal.js';

const NOMES_TIPO = { cpu: 'CPU', ram: 'Memória', disco: 'Disco', offline: 'Offline' };

function resumoOverrides(overrides) {
  const tipos = Object.keys(overrides ?? {});
  return tipos.length ? tipos.map((t) => selo(NOMES_TIPO[t] ?? t, 'neutro')) : h('span', { class: 'sutil pequeno', text: '—' });
}

/** Seletor de alvo igual ao de agendamentos/alertas (todos/cliente/site/agente), com "grupo dinâmico" a mais. */
async function escolherAlvo(container, valorInicial) {
  const opcoesSites = estado.clientes.flatMap((c) => c.sites.map((x) => [`site:${x.id}`, `Site · ${c.nome} · ${x.nome} (${x.dispositivos})`]));
  const opcoesClientes = estado.clientes.map((c) => [`cliente:${c.id}`, `Cliente · ${c.nome} (${c.dispositivos})`]);
  let grupos = [];
  try { grupos = await get('/api/grupos'); } catch { /* módulo de grupos pode não estar disponível */ }
  const opcoesGrupos = grupos.map((g) => [`grupo:${g.id}`, `Grupo dinâmico · ${g.nome} (${fmtInt(g.total)})`]);
  const totalDispositivos = estado.clientes.reduce((n, c) => n + c.dispositivos, 0);
  const sel = select([['todos', `Todos os dispositivos (${fmtInt(totalDispositivos)})`], ...opcoesClientes, ...opcoesSites, ...opcoesGrupos], valorInicial ?? 'todos');
  preencher(container, campo('Aplicar em', sel));
  return sel;
}

function abrirAplicarModal(pol) {
  modal({
    titulo: `Aplicar "${pol.nome}"`, icone: 'escudo', largura: 'sm',
    descricao: 'Grava as exceções de alerta e cria/atualiza os agendamentos nos dispositivos do alvo escolhido.',
    conteudo: (fechar) => {
      const area = h('div', {});
      escolherAlvo(area);
      const aplicar = botao('Aplicar', { variante: 'primario', icone: 'check' });
      aplicar.addEventListener('click', () => comCarregando(aplicar, async () => {
        const sel = area.querySelector('select');
        const [tipo, id] = sel.value.split(':');
        const alvo = tipo === 'todos' ? { tipo: 'todos' } : { tipo, id: Number(id) };
        const r = await comElevacao(`Aplicar a política "${pol.nome}".`, () => post(`/api/politicas/${pol.id}/aplicar`, { alvo }));
        if (!r) return;
        fechar(true);
        const falhas = r.agendamentos.filter((a) => a.erro).length;
        toast(`${fmtInt(r.dispositivos)} dispositivo(s) · ${fmtInt(r.overridesAplicados)} exceção(ões) de alerta · ${r.agendamentos.length - falhas}/${r.agendamentos.length} agendamento(s) ok`,
          falhas ? 'aviso' : 'sucesso', { titulo: pol.nome });
      }));
      return [area, h('div', { class: 'modal-acoes' }, aplicar)];
    },
  });
}

function abrirHistoricoModal(pol) {
  modal({
    titulo: 'Histórico de aplicações', descricao: pol.nome, largura: 'lg', icone: 'relogio',
    conteudo: () => {
      const corpo = h('div', {}, skeleton(5));
      get(`/api/politicas/${pol.id}`).then((d) => {
        preencher(corpo, !d.aplicacoes.length
          ? vazio({ titulo: 'Ainda não foi aplicada', ilustracao: 'relogio', compacto: true })
          : h('div', { class: 'tabela-caixa cartao' }, h('table', { class: 'tabela tabela-compacta' },
            h('thead', {}, h('tr', {}, ['Quando', 'Alvo', 'Dispositivos', 'Exceções', 'Agendamentos', 'Por'].map((t) => h('th', { scope: 'col', text: t })))),
            h('tbody', {}, d.aplicacoes.map((a) => h('tr', {},
              h('td', { class: 'mono pequeno', title: fmtData(a.aplicado_em), text: relativo(a.aplicado_em) }),
              h('td', { class: 'pequeno', text: `${a.alvo.tipo}${a.alvo.id ? ` #${a.alvo.id}` : ''}` }),
              h('td', { class: 'tabular', text: fmtInt(a.dispositivos) }),
              h('td', { class: 'tabular', text: fmtInt(a.overrides_aplicados) }),
              h('td', { class: 'pequeno', text: `${a.agendamentos.filter((x) => !x.erro).length}/${a.agendamentos.length} ok` }),
              h('td', { class: 'pequeno sutil', text: a.aplicado_por })))))));
      }).catch((e) => { toastErro(e); });
      return corpo;
    },
  });
}

export function paginaPoliticas(raiz) {
  const tabela = tabelaVirtual({
    rotulo: 'Políticas', chave: (p) => p.id, ordem: { coluna: 'nome', direcao: 'asc' },
    colunas: [
      { id: 'nome', rotulo: 'Nome', largura: 'minmax(160px, 1.5fr)', render: (p) => h('div', { class: 'celula-duas-linhas' },
        h('span', { class: 'forte', text: p.nome }), p.descricao ? h('span', { class: 'sutil pequeno', text: p.descricao }) : null), valor: (p) => p.nome },
      { id: 'overrides', rotulo: 'Exceções de alerta', largura: 'minmax(160px, 1fr)', render: (p) => h('div', { class: 'chips' }, resumoOverrides(p.overrides)) },
      { id: 'agendamentos', rotulo: 'Agendamentos', largura: '130px', render: (p) => selo(fmtInt(p.agendamentos.length), p.agendamentos.length ? 'info' : 'neutro', { icone: 'relogio' }), valor: (p) => p.agendamentos.length },
      { id: 'acoes', rotulo: '', largura: '56px', render: (p) => (pode('politicas.gerenciar') ? botaoMenu(botaoIcone('reticencias', 'Ações', { pequeno: true }), () => [
        { rotulo: 'Aplicar...', icone: 'escudo', onclick: () => abrirAplicarModal(p) },
        { rotulo: 'Ver histórico', icone: 'relogio', onclick: () => abrirHistoricoModal(p) },
        { rotulo: 'Editar', icone: 'editar', onclick: () => abrirPoliticaModal({ politica: p }) },
        '-',
        { rotulo: 'Excluir', icone: 'lixo', perigo: true, onclick: () => excluir(p) },
      ], { alinhar: 'fim' }) : null) },
    ],
    aoAbrir: (p) => { if (pode('politicas.gerenciar')) abrirPoliticaModal({ politica: p }); },
    vazio: () => vazio({
      titulo: 'Nenhuma política ainda', ilustracao: 'caixa',
      texto: 'Uma política junta exceções de alerta e agendamentos num pacote nomeado, pra aplicar de uma vez num site, cliente ou grupo — sem repetir a configuração dispositivo por dispositivo.',
      acoes: pode('politicas.gerenciar') ? [botao('Nova política', { variante: 'primario', icone: 'mais', onclick: () => abrirPoliticaModal({}) })] : [],
    }),
  });

  const corpo = h('div', {}, skeleton(6));
  raiz.append(
    cabecalhoPagina({
      titulo: 'Políticas', migalhas: [['Automação'], ['Políticas']],
      subtitulo: 'Exceções de alerta e agendamentos aplicados de uma vez a um site, cliente, dispositivo ou grupo dinâmico.',
      acoes: pode('politicas.gerenciar') ? [botao('Nova política', { variante: 'primario', icone: 'mais', onclick: () => abrirPoliticaModal({}) })] : [],
    }),
    h('section', { class: 'cartao' }, corpo));

  async function excluir(p) {
    if (!(await confirmar({ titulo: 'Excluir política', mensagem: `Excluir "${p.nome}"? Os dispositivos onde ela já foi aplicada mantêm as exceções de alerta e os agendamentos — eles só ficam avulsos, sem a política.`, rotulo: 'Excluir', perigo: true }))) return;
    try { await del(`/api/politicas/${p.id}`); toast('Política excluída.', 'sucesso'); carregar(); } catch (e) { toastErro(e); }
  }

  let primeira = true;
  async function carregar() {
    try {
      const linhas = await get('/api/politicas');
      if (primeira) { preencher(corpo, tabela.el); primeira = false; }
      tabela.definirLinhas(linhas);
    } catch (e) { toastErro(e); }
  }
  carregar();
  return aoEvento('politica', () => carregar());
}
