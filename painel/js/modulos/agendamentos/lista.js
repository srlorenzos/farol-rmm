// Lista de agendamentos: cria/edita (abrirAgendamentoModal), pausa/retoma, exclui e mostra o histórico
// de disparos de cada um. Atualiza em tempo real pelo evento 'agendamento' (emitido pelo servidor a cada
// criação/edição/disparo — ver ctx.emitir('agendamento', ...) em servidor/src/modulos/agendamentos/index.js).
import { h, preencher } from '../../nucleo/dom.js';
import { get, post, del } from '../../nucleo/api.js';
import { aoEvento, estado } from '../../nucleo/estado.js';
import { relativo, fmtData, fmtInt } from '../../nucleo/formato.js';
import { cabecalhoPagina, botao, botaoIcone, selo, vazio, skeleton, aviso } from '../../ui/componentes.js';
import { tabelaVirtual } from '../../ui/tabela-virtual.js';
import { botaoMenu } from '../../ui/flutuante.js';
import { modal, confirmar, toast, toastErro } from '../../ui/camadas.js';
import { abrirAgendamentoModal } from './modal.js';

function minutosLegivel(min) {
  if (min % 1440 === 0) return `${min / 1440} dia${min / 1440 > 1 ? 's' : ''}`;
  if (min % 60 === 0) return `${min / 60} h`;
  return `${min} min`;
}

function resumoAgenda(a) {
  return a.tipo === 'intervalo' ? `A cada ${minutosLegivel(a.intervalo_min)}` : a.cron;
}

/** Nomes de dispositivo (hostname) por id — carregado uma vez, só quando algum alvo é do tipo "agente". */
let cacheAgentes = null;
async function nomeAgente(id) {
  if (!cacheAgentes) cacheAgentes = new Map((await get('/api/agentes').catch(() => [])).map((a) => [a.id, a.hostname]));
  return cacheAgentes.get(id) ?? '1 dispositivo';
}

function resumoAlvoSincrono(alvo, mapaAgentes) {
  if (!alvo) return '—';
  if (alvo.tipo === 'todos') return 'Todos os dispositivos';
  if (alvo.tipo === 'cliente') return estado.clientes.find((c) => c.id === alvo.id)?.nome ? `Cliente · ${estado.clientes.find((c) => c.id === alvo.id).nome}` : `Cliente #${alvo.id}`;
  if (alvo.tipo === 'site') {
    for (const c of estado.clientes) { const s = c.sites.find((x) => x.id === alvo.id); if (s) return `Site · ${s.nome}`; }
    return `Site #${alvo.id}`;
  }
  if (alvo.tipo === 'agente') return mapaAgentes?.get(alvo.id) ?? '1 dispositivo';
  return alvo.tipo;
}

function abrirHistorico(a) {
  modal({
    titulo: 'Histórico de disparos', descricao: a.nome, largura: 'lg', icone: 'relogio',
    conteudo: () => {
      const corpo = h('div', {}, skeleton(5));
      get(`/api/agendamentos/${a.id}`).then((d) => {
        preencher(corpo, !d.disparos.length
          ? vazio({ titulo: 'Ainda não disparou', texto: 'Quando este agendamento rodar pela primeira vez, o resultado aparece aqui.', ilustracao: 'relogio', compacto: true })
          : h('div', { class: 'tabela-caixa cartao' }, h('table', { class: 'tabela tabela-compacta' },
            h('thead', {}, h('tr', {}, ['Disparado em', 'Lote', 'Execuções', 'Erro'].map((t) => h('th', { scope: 'col', text: t })))),
            h('tbody', {}, d.disparos.map((x) => h('tr', {},
              h('td', { class: 'mono pequeno', title: fmtData(x.disparado_em), text: relativo(x.disparado_em) }),
              h('td', {}, x.lote ? h('code', { class: 'inline pequeno', text: x.lote.slice(0, 8) }) : h('span', { class: 'sutil', text: '—' })),
              h('td', { class: 'tabular', text: fmtInt(x.n_jobs) }),
              h('td', {}, x.erro ? h('span', { class: 'texto-critico pequeno', text: x.erro }) : h('span', { class: 'sutil', text: '—' }))))))));
      }).catch((e) => { toastErro(e); preencher(corpo, aviso('Não foi possível carregar o histórico.', 'critico')); });
      return corpo;
    },
  });
}

export function paginaAgendamentos(raiz) {
  let linhas = [];
  const colunas = [
    { id: 'nome', rotulo: 'Nome', largura: 'minmax(180px, 2fr)', render: (a) => h('div', { class: 'celula-duas-linhas' },
      h('span', { class: 'forte', text: a.nome }), h('small', { class: 'sutil', text: a.script_id ? 'Meus scripts' : `Biblioteca · ${a.biblioteca_id}` })), valor: (a) => a.nome },
    { id: 'agenda', rotulo: 'Quando roda', largura: 'minmax(140px, 1fr)', render: (a) => h('span', { class: a.tipo === 'cron' ? 'mono pequeno' : '', text: resumoAgenda(a) }), valor: (a) => a.tipo },
    { id: 'alvo', rotulo: 'Onde roda', largura: 'minmax(140px, 1fr)', render: (a) => h('span', { text: resumoAlvoSincrono(a.alvo, cacheAgentes) }), valor: (a) => a.alvo?.tipo },
    { id: 'estado', rotulo: 'Estado', largura: '110px', render: (a) => selo(a.ativo ? 'Ativo' : 'Pausado', a.ativo ? 'ok' : 'neutro'), valor: (a) => (a.ativo ? 0 : 1) },
    { id: 'proxima', rotulo: 'Próxima execução', largura: '150px', render: (a) => a.ativo && a.proxima_execucao
      ? h('span', { title: fmtData(a.proxima_execucao), text: relativo(a.proxima_execucao) }) : h('span', { class: 'sutil', text: '—' }), valor: (a) => a.proxima_execucao ?? Infinity },
    { id: 'ultima', rotulo: 'Última execução', largura: '150px', render: (a) => a.ultima_execucao
      ? h('span', { class: 'muted', title: fmtData(a.ultima_execucao), text: relativo(a.ultima_execucao) }) : h('span', { class: 'sutil', text: 'Nunca' }), valor: (a) => -(a.ultima_execucao ?? 0) },
    { id: 'acoes', rotulo: '', largura: '56px', render: (a) => botaoMenu(botaoIcone('reticencias', 'Ações', { pequeno: true }), () => [
      { rotulo: 'Ver histórico', icone: 'relogio', onclick: () => abrirHistorico(a) },
      { rotulo: 'Editar', icone: 'editar', onclick: () => abrirAgendamentoModal({ agendamento: a }) },
      { rotulo: a.ativo ? 'Pausar' : 'Retomar', icone: a.ativo ? 'revogar' : 'play', onclick: () => alternar(a) },
      '-',
      { rotulo: 'Excluir', icone: 'lixo', perigo: true, onclick: () => excluir(a) },
    ], { alinhar: 'fim' }) },
  ];

  const tabela = tabelaVirtual({
    rotulo: 'Agendamentos', chave: (a) => a.id, colunas, ordem: { coluna: 'nome', direcao: 'asc' },
    aoAbrir: (a) => abrirAgendamentoModal({ agendamento: a }),
    vazio: () => vazio({
      titulo: 'Nenhum agendamento ainda', texto: 'Crie um agendamento para rodar um script periodicamente ou por expressão cron, sem precisar disparar na mão.',
      ilustracao: 'relogio', acoes: [botao('Novo agendamento', { variante: 'primario', icone: 'mais', onclick: novo })],
    }),
  });

  const corpo = h('div', {}, skeleton(6));
  raiz.append(
    cabecalhoPagina({
      titulo: 'Agendamentos', migalhas: [['Automação'], ['Agendamentos']],
      subtitulo: 'Scripts que rodam sozinhos: de tempos em tempos ou numa expressão cron, nos dispositivos que você escolher.',
      acoes: [botao('Novo agendamento', { variante: 'primario', icone: 'mais', onclick: novo })],
    }),
    h('section', { class: 'cartao' }, corpo));

  function novo() { abrirAgendamentoModal({}); }

  async function alternar(a) {
    try {
      await post(`/api/agendamentos/${a.id}/${a.ativo ? 'pausar' : 'retomar'}`);
      toast(a.ativo ? 'Agendamento pausado.' : 'Agendamento retomado.', 'sucesso');
      carregar();
    } catch (e) { toastErro(e); }
  }

  async function excluir(a) {
    if (!(await confirmar({ titulo: 'Excluir agendamento', mensagem: `Excluir "${a.nome}"? O histórico de disparos já feitos é mantido na auditoria, mas não aparece mais aqui.`, rotulo: 'Excluir', perigo: true }))) return;
    try { await del(`/api/agendamentos/${a.id}`); toast('Agendamento excluído.', 'sucesso'); carregar(); } catch (e) { toastErro(e); }
  }

  let primeira = true;
  async function carregar() {
    try {
      linhas = await get('/api/agendamentos');
      if (linhas.some((a) => a.alvo?.tipo === 'agente')) await nomeAgente(linhas.find((a) => a.alvo?.tipo === 'agente').alvo.id); // garante a cache antes de desenhar
      if (primeira) { preencher(corpo, tabela.el); primeira = false; }
      tabela.definirLinhas(linhas);
    } catch (e) { toastErro(e); }
  }
  carregar();
  return aoEvento('agendamento', () => carregar());
}

export { abrirAgendamentoModal };
