// Detalhe do agente: cabeçalho, gráficos de CPU/RAM, discos, inventário, execuções e console.
import { h, icone, limpar, preencher, relativo, fmtBytes, fmtDuracao, fmtData, fmtPct, fmtMs, ramPct, debounce, NOMES_SHELL } from '../util.js';
import { get, post } from '../api.js';
import { skeleton, barra, statusAgente, statusJob, vazio, toastErro, toast, bloco, confirmar, miniBarra } from '../ui.js';
import { graficoLinha } from '../graficos.js';
import { aoEvento } from '../estado.js';
import { escolherScriptEExecutar, enviarExecucao } from '../acoes.js';

const FINAIS = new Set(['sucesso', 'falha', 'timeout', 'expirado', 'cancelado']);

export function render(raiz, { params, query }) {
  const id = params.id;
  let agente = null;
  let horas = 24;
  let abaAtual = query.get('aba') || 'desempenho';
  const limpezas = [];

  const cabecalho = h('header', { class: 'agente-cabecalho' }, skeleton(2));
  const abas = h('div', { class: 'abas abas-pagina', role: 'tablist', 'aria-label': 'Seções do agente' });
  const conteudo = h('div', { class: 'aba-conteudo' });
  raiz.append(h('a', { class: 'voltar', href: '#/agentes' }, icone('voltar', { tamanho: 16 }), 'Agentes'), cabecalho, abas, conteudo);

  const SECOES = { desempenho: 'Desempenho', inventario: 'Inventário', execucoes: 'Execuções', console: 'Console' };
  function desenharAbas() {
    preencher(abas, Object.entries(SECOES).map(([k, t]) => h('button', {
      class: 'aba', role: 'tab', type: 'button', id: `aba-${k}`, 'aria-selected': String(k === abaAtual), 'aria-controls': 'painel-aba',
      onclick: () => { abaAtual = k; history.replaceState(null, '', `#/agentes/${id}${k === 'desempenho' ? '' : `?aba=${k}`}`); desenharAbas(); desenharConteudo(); },
    }, t)));
    conteudo.id = 'painel-aba';
    conteudo.setAttribute('role', 'tabpanel');
    conteudo.setAttribute('aria-labelledby', `aba-${abaAtual}`);
  }

  function desenharCabecalho() {
    const a = agente;
    preencher(cabecalho, 
      h('div', { class: 'agente-titulo' },
        h('div', {}, h('h1', { text: a.hostname }), h('p', { class: 'muted', text: a.so_versao || a.so || 'Sistema desconhecido' })),
        h('div', { class: 'pagina-acoes' },
          a.revogado ? null : h('button', { class: 'btn btn-primario', onclick: () => escolherScriptEExecutar([a]) }, icone('play', { tamanho: 14 }), 'Executar script'),
          a.revogado ? null : h('button', { class: 'btn btn-perigo-sutil', onclick: revogar }, icone('revogar', { tamanho: 14 }), 'Revogar'))),
      h('dl', { class: 'fatos' },
        fato('Status', statusAgente(a.status)),
        fato('IP local', h('span', { class: 'mono', text: a.ip_local || '—' })),
        fato('Usuário', a.usuario_logado || '—'),
        fato('Ligado há', fmtDuracao(a.uptime)),
        fato('Último contato', relativo(a.ultimo_checkin)),
        fato('CPU', miniBarra(a.cpu_pct, 'CPU')),
        fato('RAM', h('span', {}, miniBarra(ramPct(a), 'RAM'))),
        fato('Agente', `v${a.versao_agente || '?'} · ${a.arquitetura || ''}`)));
  }

  async function revogar() {
    const ok = await confirmar({
      titulo: 'Revogar agente', perigo: true, rotulo: 'Revogar',
      mensagem: `O agente “${agente.hostname}” perderá o acesso imediatamente e sairá da lista. Jobs pendentes serão cancelados. Para voltar, será preciso reinstalar com um novo token.`,
    });
    if (!ok) return;
    try {
      await post(`/api/agentes/${id}/revogar`);
      toast('Agente revogado.', 'sucesso');
      location.hash = '#/agentes';
    } catch (e) { toastErro(e); }
  }

  // ---------- Desempenho ----------
  async function desenharDesempenho(alvo) {
    const seletor = h('div', { class: 'segmentado', role: 'group', 'aria-label': 'Período' },
      [[1, '1 h'], [24, '24 h'], [168, '7 dias']].map(([v, t]) => h('button', {
        class: 'segmento', type: 'button', 'aria-pressed': String(v === horas),
        onclick: () => { horas = v; desenharConteudo(); },
      }, t)));
    const graficos = h('div', { class: 'grade-2' }, h('div', { class: 'painel-bloco' }, skeleton(6)), h('div', { class: 'painel-bloco' }, skeleton(6)));
    const discos = h('section', { class: 'painel-bloco' }, h('h2', { text: 'Discos' }), discosLista(agente.discos));
    alvo.append(h('div', { class: 'filtros' }, seletor), graficos, discos);
    try {
      const m = await get(`/api/agentes/${id}/metricas?horas=${horas}`);
      const ate = Date.now();
      preencher(graficos, 
        h('div', { class: 'painel-bloco' }, graficoLinha({ titulo: 'CPU', pontos: m.pontos, campo: 'cpu', desde: m.desde, ate, baldeMs: m.baldeMs })),
        h('div', { class: 'painel-bloco' }, graficoLinha({ titulo: 'Memória RAM', pontos: m.pontos, campo: 'ram', desde: m.desde, ate, baldeMs: m.baldeMs })));
    } catch (e) { toastErro(e); }
  }

  function discosLista(lista) {
    if (!lista?.length) return h('p', { class: 'muted', text: 'Sem dados de disco.' });
    return h('ul', { class: 'lista-discos' }, lista.map((d) => h('li', {},
      h('div', { class: 'linha-entre' },
        h('span', {}, h('strong', { class: 'mono', text: d.ponto }), h('span', { class: 'muted', text: ` ${d.fs || ''}` })),
        h('span', {}, h('strong', { text: fmtPct(d.pct) }), h('span', { class: 'muted', text: ` · ${fmtBytes(d.total - d.usado)} livres de ${fmtBytes(d.total)}` }))),
      barra(d.pct, `Uso do disco ${d.ponto}`))));
  }

  // ---------- Inventário ----------
  function desenharInventario(alvo) {
    const inv = agente.inventario;
    if (!inv) {
      alvo.append(vazio('Inventário ainda não recebido', 'O agente envia o inventário completo no primeiro check-in e depois a cada hora.'));
      return;
    }
    let sub = 'hardware';
    const subAbas = h('div', { class: 'abas abas-sub', role: 'tablist', 'aria-label': 'Inventário' });
    const area = h('div', {});
    const desenhar = () => {
      preencher(subAbas, [['hardware', 'Hardware'], ['rede', 'Rede'], ['softwares', `Softwares (${inv.softwares?.length ?? 0})`]].map(([k, t]) =>
        h('button', { class: 'aba', role: 'tab', type: 'button', 'aria-selected': String(k === sub), onclick: () => { sub = k; desenhar(); } }, t)));
      preencher(area, sub === 'hardware' ? hardware(inv) : sub === 'rede' ? rede(inv) : softwares(inv));
    };
    desenhar();
    alvo.append(h('p', { class: 'muted pequeno', text: `Coletado ${relativo(agente.inventario_em)} (${fmtData(agente.inventario_em)})` }), subAbas, area);
  }

  function hardware(inv) {
    const hw = inv.hardware || {};
    const so = inv.sistema || {};
    return h('div', { class: 'grade-2' },
      h('section', { class: 'painel-bloco' }, h('h2', { text: 'Máquina' }), h('dl', { class: 'tabela-def' },
        def('Fabricante', hw.fabricante), def('Modelo', hw.modelo), def('Número de série', hw.serial),
        def('Processador', hw.cpu_modelo),
        def('Núcleos', hw.nucleos_fisicos ? `${hw.nucleos_fisicos} físicos · ${hw.nucleos_logicos} lógicos` : hw.nucleos_logicos),
        def('Memória total', fmtBytes(hw.ram_total)))),
      h('section', { class: 'painel-bloco' }, h('h2', { text: 'Sistema' }), h('dl', { class: 'tabela-def' },
        def('Sistema', so.versao), def('Hostname', so.hostname), def('Arquitetura', so.arquitetura),
        def('Inicializado em', so.boot ? fmtData(so.boot * 1000) : null), def('Python do agente', so.python))));
  }

  function rede(inv) {
    const lista = (inv.rede || []).slice().sort((a, b) => Number(b.ativa) - Number(a.ativa));
    return h('div', { class: 'tabela-rolagem' }, h('table', { class: 'tabela' },
      h('thead', {}, h('tr', {}, ['Interface', 'Estado', 'MAC', 'IPv4', 'IPv6', 'Velocidade'].map((t) => h('th', { scope: 'col' }, t)))),
      h('tbody', {}, lista.map((n) => h('tr', {},
        h('td', { text: n.nome }),
        h('td', {}, h('span', { class: `selo ${n.ativa ? 'selo-ok' : ''}`, text: n.ativa ? 'Ativa' : 'Inativa' })),
        h('td', { class: 'mono', text: n.mac || '—' }),
        h('td', { class: 'mono', text: (n.ipv4 || []).join(', ') || '—' }),
        h('td', { class: 'mono quebra', text: (n.ipv6 || []).join(', ') || '—' }),
        h('td', { text: n.velocidade_mbps ? `${n.velocidade_mbps} Mbps` : '—' }))))));
  }

  function softwares(inv) {
    const todos = inv.softwares || [];
    const busca = h('input', { class: 'input', type: 'search', placeholder: 'Buscar software ou fabricante…', 'aria-label': 'Buscar software' });
    const corpo = h('tbody');
    const contagem = h('span', { class: 'muted' });
    const desenhar = () => {
      const q = busca.value.trim().toLowerCase();
      const f = todos.filter((s) => !q || s.nome.toLowerCase().includes(q) || (s.fabricante || '').toLowerCase().includes(q));
      contagem.textContent = `${f.length} de ${todos.length}`;
      preencher(corpo, f.slice(0, 500).map((s) => h('tr', {},
        h('td', { text: s.nome }), h('td', { class: 'mono', text: s.versao || '—' }), h('td', { class: 'muted', text: s.fabricante || '—' }))));
      if (f.length > 500) corpo.append(h('tr', {}, h('td', { colspan: 3, class: 'muted centro', text: `Mostrando 500 de ${f.length}. Refine a busca.` })));
    };
    busca.addEventListener('input', debounce(desenhar, 120));
    desenhar();
    return h('div', {},
      h('div', { class: 'filtros' }, h('label', { class: 'busca' }, icone('busca', { tamanho: 16 }), busca), contagem),
      h('div', { class: 'tabela-rolagem' }, h('table', { class: 'tabela' },
        h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, 'Nome'), h('th', { scope: 'col' }, 'Versão'), h('th', { scope: 'col' }, 'Fabricante'))), corpo)));
  }

  // ---------- Execuções ----------
  const abertos = new Set();
  async function desenharExecucoes(alvo) {
    const lista = h('div', {}, skeleton(5));
    alvo.append(lista);
    const carregar = async () => {
      try {
        const jobs = await get(`/api/agentes/${id}/jobs`);
        preencher(lista, jobs.length ? h('ul', { class: 'lista-jobs' }, jobs.map(itemJob))
          : vazio('Nenhuma execução neste agente', 'Use “Executar script” ou o Console.'));
      } catch (e) { toastErro(e); }
    };
    await carregar();
    limpezas.push(aoEvento('job', (d) => { if (d.agente_id === id && abaAtual === 'execucoes') carregar(); }));
  }

  function itemJob(j) {
    const detalhes = h('div', { class: 'job-saida' });
    const botao = h('button', { class: 'job-cabecalho', type: 'button', 'aria-expanded': 'false' },
      icone('chevron', { tamanho: 16 }),
      h('span', { class: 'job-nome' }, h('strong', { text: j.nome }),
        h('span', { class: 'muted', text: `${NOMES_SHELL[j.shell] ?? j.shell} · ${j.criado_por} · ${fmtData(j.criado_em)}${j.duracao_ms != null ? ` · ${fmtMs(j.duracao_ms)}` : ''}` })),
      j.codigo_saida != null ? h('span', { class: 'mono muted pequeno', text: `código ${j.codigo_saida}` }) : null,
      statusJob(j.status));
    const abrir = async () => {
      const aberto = botao.getAttribute('aria-expanded') === 'true';
      botao.setAttribute('aria-expanded', String(!aberto));
      if (aberto) { abertos.delete(j.id); limpar(detalhes); return; }
      abertos.add(j.id);
      preencher(detalhes, skeleton(3));
      try {
        const c = await get(`/api/jobs/${j.id}`);
        preencher(detalhes, saidaJob(c));
      } catch (e) { toastErro(e); }
    };
    botao.addEventListener('click', abrir);
    const li = h('li', { class: 'job' }, botao, detalhes);
    if (abertos.has(j.id)) { abertos.delete(j.id); abrir(); }
    return li;
  }

  // ---------- Console ----------
  function desenharConsole(alvo) {
    const windows = /windows/i.test(agente.so || '');
    const shell = h('select', { class: 'input select', 'aria-label': 'Interpretador' },
      (windows ? ['powershell', 'cmd', 'python'] : ['bash', 'python', 'powershell']).map((v) => h('option', { value: v }, NOMES_SHELL[v])));
    const comando = h('textarea', {
      class: 'input editor-console mono', rows: 4, spellcheck: 'false', autocapitalize: 'off',
      placeholder: windows ? 'Get-Service | Where-Object Status -eq Stopped' : 'uptime && df -h', 'aria-label': 'Comando',
    });
    const saida = h('div', { class: 'console-saida', 'aria-live': 'polite' },
      h('p', { class: 'muted', text: 'A saída aparece aqui. Ctrl+Enter executa.' }));
    const executar = h('button', { class: 'btn btn-primario', type: 'submit' }, icone('play', { tamanho: 14 }), 'Executar');
    let aguardando = null;
    const form = h('form', {
      class: 'form console', onsubmit: async (ev) => {
        ev.preventDefault();
        const texto = comando.value.trim();
        if (!texto) return;
        executar.disabled = true;
        const r = await enviarExecucao({ agentes: [id], comando: texto, shell: shell.value, timeout: 120 },
          `Executar um comando em ${agente.hostname}.`);
        executar.disabled = false;
        if (!r) return;
        aguardando = r.jobs[0].id;
        preencher(saida, h('p', { class: 'muted aguardando' }, h('span', { class: 'giro', 'aria-hidden': 'true' }),
          agente.status === 'online' ? 'Aguardando o próximo check-in do agente…' : 'Agente offline: o comando roda quando ele voltar.'));
      },
    },
    h('div', { class: 'linha-entre' }, shell, executar), comando);
    comando.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) form.requestSubmit(); });
    limpezas.push(aoEvento('job', async (d) => {
      if (d.id !== aguardando || !FINAIS.has(d.status)) return;
      try { preencher(saida, saidaJob(await get(`/api/jobs/${d.id}`))); } catch (e) { toastErro(e); }
      aguardando = null;
    }));
    alvo.append(h('section', { class: 'painel-bloco' },
      h('h2', { text: 'Comando rápido' }),
      h('p', { class: 'muted', text: 'Executa como o usuário do serviço do agente (SYSTEM/root). Exige confirmação 2FA e fica registrado na auditoria.' }),
      form, saida));
    requestAnimationFrame(() => comando.focus());
  }

  function desenharConteudo() {
    limpezas.splice(0).forEach((f) => f());
    limpar(conteudo);
    if (!agente) return;
    ({ desempenho: desenharDesempenho, inventario: desenharInventario, execucoes: desenharExecucoes, console: desenharConsole })[abaAtual]?.(conteudo);
  }

  async function carregar(redesenhar = true) {
    try {
      agente = await get(`/api/agentes/${id}`);
      desenharCabecalho();
      if (redesenhar) { desenharAbas(); desenharConteudo(); }
    } catch (e) {
      preencher(cabecalho, vazio('Agente não encontrado', e.message));
    }
  }
  carregar();

  const cancelar = [
    aoEvento('checkin', (d) => {
      if (d.id !== id || !agente) return;
      Object.assign(agente, d);
      desenharCabecalho();
    }),
    aoEvento('agente', (d) => { if (d.id === id) carregar(false); }),
  ];
  return () => { cancelar.forEach((c) => c()); limpezas.forEach((f) => f()); };
}

export function saidaJob(j) {
  const partes = [];
  if (j.stdout) partes.push(h('div', { class: 'saida-bloco' }, h('span', { class: 'rotulo', text: 'Saída' }), bloco(j.stdout)));
  if (j.stderr) partes.push(h('div', { class: 'saida-bloco' }, h('span', { class: 'rotulo rotulo-erro', text: 'Erros' }), bloco(j.stderr, 'bloco-erro')));
  if (!partes.length) partes.push(h('p', { class: 'muted', text: FINAIS.has(j.status) ? 'Sem saída.' : 'Ainda em execução…' }));
  return h('div', {},
    h('p', { class: 'muted pequeno' }, statusJob(j.status), j.codigo_saida != null ? ` código de saída ${j.codigo_saida}` : '',
      j.duracao_ms != null ? ` · ${fmtMs(j.duracao_ms)}` : '', j.concluido_em ? ` · ${fmtData(j.concluido_em)}` : ''),
    partes);
}

function fato(rotulo, valor) {
  return h('div', { class: 'fato' }, h('dt', { text: rotulo }), h('dd', {}, valor));
}

function def(rotulo, valor) {
  return [h('dt', { text: rotulo }), h('dd', { text: valor == null || valor === '' ? '—' : String(valor) })];
}
