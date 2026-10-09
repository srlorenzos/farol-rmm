// Histórico de execuções (global e por dispositivo), saída numa gaveta, comando rápido e widget do painel.
import { h, preencher, debounce } from '../../nucleo/dom.js';
import { icone } from '../../nucleo/icones.js';
import { get, post, qs } from '../../nucleo/api.js';
import { aoEvento, paramsEscopo, pode } from '../../nucleo/estado.js';
import { relativo, fmtData, fmtMs, NOMES_SHELL, soChave } from '../../nucleo/formato.js';
import { cabecalhoPagina, statusJob, vazio, skeleton, blocoMono, listaDef, selo, botao, chipsFiltro, select, cartao } from '../../ui/componentes.js';
import { tabelaVirtual } from '../../ui/tabela-virtual.js';
import { gaveta, toast, toastErro } from '../../ui/camadas.js';
import { executarScript, comandoRapido } from './executar.js';
import { editorCodigo } from './meus.js';

const FINAIS = new Set(['sucesso', 'falha', 'timeout', 'expirado', 'cancelado']);
const MONITOR = { ok: ['OK', 'ok'], alerta: ['Alerta', 'aviso'], critico: ['Crítico', 'critico'] };

function colunas({ comDispositivo = true } = {}) {
  return [
    { id: 'status', rotulo: 'Status', largura: '150px', render: (j) => statusJob(j.status), valor: (j) => j.status },
    { id: 'nome', rotulo: 'Script / comando', largura: 'minmax(220px, 2fr)', render: (j) => h('div', { class: 'celula-duas-linhas' }, h('span', { class: 'forte', text: j.nome }),
      h('span', { class: 'sutil pequeno', text: `${NOMES_SHELL[j.shell] ?? j.shell}${j.origem?.startsWith('biblioteca:') ? ' · biblioteca' : j.origem === 'comando' ? ' · comando rápido' : ''}` })), valor: (j) => j.nome },
    ...(comDispositivo ? [{ id: 'disp', rotulo: 'Dispositivo', largura: 'minmax(150px, 1fr)', render: (j) => h('a', { href: `#/dispositivos/${j.agente_id}?aba=execucoes`, text: j.hostname }), valor: (j) => j.hostname }] : []),
    { id: 'monitor', rotulo: 'Resultado', largura: '120px', padrao: false, render: (j) => (j.monitor_status ? selo(MONITOR[j.monitor_status][0], MONITOR[j.monitor_status][1]) : j.codigo_saida != null ? h('span', { class: 'mono pequeno sutil', text: `código ${j.codigo_saida}` }) : '—'), valor: (j) => j.codigo_saida },
    { id: 'por', rotulo: 'Por', largura: '110px', render: (j) => h('span', { class: 'muted', text: j.criado_por }), valor: (j) => j.criado_por },
    { id: 'quando', rotulo: 'Quando', largura: '120px', render: (j) => h('span', { class: 'muted', title: fmtData(j.criado_em), text: relativo(j.criado_em) }), valor: (j) => -j.criado_em },
    { id: 'duracao', rotulo: 'Duração', largura: '96px', num: true, render: (j) => (j.duracao_ms != null ? fmtMs(j.duracao_ms) : '—'), valor: (j) => j.duracao_ms },
  ];
}

export async function abrirJob(id) {
  const corpo = h('div', {}, skeleton(6));
  const camada = gaveta({ titulo: 'Execução', larga: true, conteudo: () => corpo });
  const desenhar = async () => {
    try {
      const j = await get(`/api/jobs/${id}`);
      preencher(corpo, h('div', { class: 'pilha' },
        h('div', { class: 'linha' }, statusJob(j.status), j.monitor_status ? selo(`Monitor: ${MONITOR[j.monitor_status][0]}`, MONITOR[j.monitor_status][1]) : null),
        listaDef([['Script', j.nome], ['Dispositivo', h('a', { href: `#/dispositivos/${j.agente_id}?aba=execucoes`, text: j.hostname })], ['Interpretador', NOMES_SHELL[j.shell]],
          ['Executado por', j.criado_por], ['Criado', fmtData(j.criado_em, { segundos: true })], ['Concluído', j.concluido_em ? fmtData(j.concluido_em, { segundos: true }) : '—'],
          ['Duração', fmtMs(j.duracao_ms)], ['Código de saída', j.codigo_saida ?? '—'], j.monitor_msg ? ['Mensagem do monitor', j.monitor_msg] : null].filter(Boolean)),
        j.stdout ? h('div', {}, h('h3', { class: 'mb-2', text: 'Saída' }), blocoMono(j.stdout)) : null,
        j.stderr ? h('div', {}, h('h3', { class: 'mb-2 texto-critico', text: 'Erros' }), blocoMono(j.stderr, { erro: true })) : null,
        !j.stdout && !j.stderr ? vazio({ titulo: FINAIS.has(j.status) ? 'Sem saída' : 'Executando…', texto: FINAIS.has(j.status) ? null : 'A saída aparece aqui assim que o dispositivo devolver.', compacto: true, ilustracao: FINAIS.has(j.status) ? 'caixa' : 'farol' }) : null,
        h('details', {}, h('summary', { class: 'pequeno sutil', estilo: { cursor: 'pointer' } }, 'Ver o script executado'), h('div', { class: 'mt-2' }, blocoMono(j.conteudo))),
        j.status === 'pendente' && pode('scripts.executar') ? botao('Cancelar execução', { variante: 'perigo-sutil', icone: 'revogar', onclick: async () => { try { await post(`/api/jobs/${j.id}/cancelar`); toast('Execução cancelada.', 'sucesso'); desenhar(); } catch (e) { toastErro(e); } } }) : null));
      return j;
    } catch (e) { toastErro(e); return null; }
  };
  const j = await desenhar();
  if (j && !FINAIS.has(j.status)) {
    const parar = aoEvento('job', (d) => { if (d.id === id && FINAIS.has(d.status)) { desenhar(); parar(); } });
    camada.promessa.then(parar);
  }
}

export function paginaExecucoes(raiz, { query }) {
  let status = query.get('status') || '';
  const tabela = tabelaVirtual({ rotulo: 'Execuções', chave: (j) => j.id, colunas: colunas(), ordem: { coluna: 'quando', direcao: 'asc' }, aoAbrir: (j) => abrirJob(j.id), abrirComClique: true,
    vazio: () => vazio({ titulo: 'Nenhuma execução ainda', texto: 'Rode um script da biblioteca ou um comando rápido num dispositivo.', ilustracao: 'farol',
      acoes: [botao('Abrir a biblioteca', { href: '#/biblioteca', icone: 'biblioteca' })] }) });
  const chips = chipsFiltro([{ id: 'sucesso', rotulo: 'Sucesso', ponto: 'ok' }, { id: 'falha', rotulo: 'Falha', ponto: 'critico' }, { id: 'enviado', rotulo: 'Executando', ponto: 'info' },
    { id: 'pendente', rotulo: 'Na fila', ponto: '' }, { id: 'timeout', rotulo: 'Tempo esgotado', ponto: 'aviso' }], status, (v) => { status = v; carregar(); }, { rotulo: 'Status' });
  const corpo = h('div', {}, skeleton(8));
  raiz.append(cabecalhoPagina({ titulo: 'Execuções', migalhas: [['Automação'], ['Execuções']], subtitulo: 'Histórico de scripts e comandos. Clique numa linha (ou Enter) para ver a saída.',
    acoes: pode('scripts.executar') ? [botao('Executar script', { variante: 'primario', icone: 'play', onclick: () => executarScript() })] : [] }),
  h('section', { class: 'cartao' }, h('div', { class: 'ferramentas' }, chips), corpo));
  let primeira = true;
  async function carregar() {
    try {
      const jobs = await get(`/api/jobs${qs({ limite: 500, status, ...paramsEscopo() })}`);
      if (primeira) { preencher(corpo, tabela.el); primeira = false; }
      tabela.definirLinhas(jobs);
    } catch (e) { toastErro(e); }
  }
  carregar();
  return aoEvento('job', debounce(carregar, 500));
}

export function abaExecucoes(el, { agente }) {
  const windows = soChave(agente.so) === 'windows';
  const shell = select((windows ? ['powershell', 'cmd', 'python'] : ['bash', 'python', 'powershell']).map((v) => [v, NOMES_SHELL[v]]), null, { rotulo: 'Interpretador' });
  const { el: editor, textarea } = editorCodigo('');
  textarea.rows = 4;
  textarea.style.minHeight = '96px';
  textarea.placeholder = windows ? 'Get-Service | Where-Object Status -eq Stopped' : 'uptime && df -h';
  textarea.setAttribute('aria-label', 'Comando');
  const saida = h('div', { class: 'mt-3', 'aria-live': 'polite' });
  let aguardando = null;
  const executar = botao('Executar', { variante: 'primario', icone: 'play', tipo: 'submit' });
  const form = h('form', {
    class: 'pilha-2', onsubmit: async (ev) => {
      ev.preventDefault();
      const texto = textarea.value.trim();
      if (!texto) return;
      executar.disabled = true;
      const r = await comandoRapido(agente, texto, shell.value);
      executar.disabled = false;
      if (!r) return;
      aguardando = r.jobs[0]?.id;
      preencher(saida, h('p', { class: 'muted pequeno' }, h('span', { class: 'giro', 'aria-hidden': 'true' }), ' ',
        agente.tempo_real ? 'Enviado em tempo real; aguardando a saída…' : agente.status === 'online' ? 'Aguardando o próximo check-in…' : 'Dispositivo offline: roda quando ele voltar.'));
    },
  }, editor, h('div', { class: 'linha-entre' }, h('div', { class: 'linha' }, shell, h('span', { class: 'sutil pequeno', text: 'Ctrl+Enter executa · roda como SYSTEM/root · auditado' })), executar), saida);
  textarea.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) form.requestSubmit(); });

  const tabela = tabelaVirtual({ rotulo: 'Execuções do dispositivo', chave: (j) => j.id, colunas: colunas({ comDispositivo: false }), ordem: { coluna: 'quando', direcao: 'asc' }, aoAbrir: (j) => abrirJob(j.id), abrirComClique: true,
    vazio: () => vazio({ titulo: 'Nenhuma execução neste dispositivo', texto: 'Use “Executar script” ou o comando rápido acima.', compacto: true, ilustracao: 'caixa' }) });
  el.append(h('div', { class: 'pilha' },
    pode('scripts.executar') ? cartao({ titulo: 'Comando rápido', sub: 'PowerShell, CMD, Bash ou Python — exige confirmação 2FA', corpo: form }) : null,
    cartao({ titulo: 'Histórico', sub: 'Clique numa linha para ver a saída', semPadding: true,
      acoes: pode('scripts.executar') ? [botao('Executar script', { tamanho: 'pequeno', icone: 'play', onclick: () => executarScript({ agentes: [agente] }) })] : null, corpo: tabela.el })));
  const carregar = async () => { try { tabela.definirLinhas(await get(`/api/agentes/${agente.id}/jobs`)); } catch (e) { toastErro(e); } };
  carregar();
  return aoEvento('job', async (d) => {
    if (d.agente_id !== agente.id) return;
    carregar();
    if (d.id === aguardando && FINAIS.has(d.status)) {
      aguardando = null;
      try {
        const j = await get(`/api/jobs/${d.id}`);
        preencher(saida, h('div', { class: 'pilha-2' }, h('div', { class: 'linha' }, statusJob(j.status), h('span', { class: 'sutil pequeno', text: `${fmtMs(j.duracao_ms)} · código ${j.codigo_saida ?? '—'}` })),
          j.stdout ? blocoMono(j.stdout) : null, j.stderr ? blocoMono(j.stderr, { erro: true }) : null, !j.stdout && !j.stderr ? h('p', { class: 'sutil pequeno', text: 'Sem saída.' }) : null));
      } catch (e) { toastErro(e); }
    }
  });
}

export function widgetExecucoes(el) {
  const corpo = h('div', { class: 'cartao-corpo sem-padding' }, h('div', { class: 'cartao-corpo' }, skeleton(5)));
  el.append(h('header', { class: 'cartao-cabecalho' }, h('h2', { text: 'Últimas execuções' }), h('a', { class: 'widget-acao', href: '#/execucoes' }, 'Ver todas', icone('chevron', { tamanho: 12 }))), corpo);
  const desenhar = async () => {
    try {
      const jobs = await get(`/api/jobs${qs({ limite: 7, ...paramsEscopo() })}`);
      preencher(corpo, jobs.length ? h('ul', { class: 'lista-linhas' }, jobs.map((j) => h('li', {},
        h('button', { class: 'linha-item', type: 'button', onclick: () => abrirJob(j.id) },
          h('div', { class: 'linha-texto' }, h('span', { class: 'forte', text: j.nome }), h('small', { text: `${j.hostname} · ${j.criado_por} · ${relativo(j.criado_em)}` })), statusJob(j.status)))))
        : vazio({ titulo: 'Nenhum script executado ainda', texto: 'A biblioteca tem centenas prontos para usar.', compacto: true, ilustracao: 'farol', acoes: [botao('Abrir a biblioteca', { href: '#/biblioteca', tamanho: 'pequeno' })] }));
    } catch (e) { toastErro(e); }
  };
  desenhar();
  return aoEvento('job', debounce(desenhar, 800));
}
