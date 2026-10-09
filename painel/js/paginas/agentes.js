// Lista de agentes: busca, filtros, seleção múltipla e atualização ao vivo.
import { h, icone, preencher, relativo, ramPct, debounce } from '../util.js';
import { get } from '../api.js';
import { cabecalhoPagina, skeleton, miniBarra, statusAgente, vazio, toastErro } from '../ui.js';
import { aoEvento } from '../estado.js';
import { adicionarAgente, escolherScriptEExecutar } from '../acoes.js';

export function render(raiz, { query }) {
  let agentes = [];
  const selecionados = new Set();
  const filtro = { q: query.get('q') || '', status: query.get('status') || '', so: query.get('so') || '' };

  const busca = h('input', { class: 'input', type: 'search', placeholder: 'Buscar por nome, IP ou usuário…', value: filtro.q, 'aria-label': 'Buscar agentes' });
  const selStatus = select('Status', [['', 'Todos os status'], ['online', 'Online'], ['offline', 'Offline'], ['pendente', 'Aguardando']], filtro.status);
  const selSo = select('Sistema', [['', 'Todos os sistemas'], ['Windows', 'Windows'], ['Linux', 'Linux'], ['Darwin', 'macOS']], filtro.so);
  const barraLote = h('div', { class: 'barra-lote', hidden: true, role: 'region', 'aria-label': 'Ações em lote' });
  const tabela = h('div', { class: 'tabela-rolagem' }, skeleton(6));
  const total = h('span', { class: 'muted' });

  raiz.append(
    cabecalhoPagina('Agentes', 'Computadores com o agente Farol instalado',
      h('button', { class: 'btn btn-primario', onclick: adicionarAgente }, icone('mais', { tamanho: 16 }), 'Adicionar agente')),
    h('div', { class: 'filtros' },
      h('label', { class: 'busca' }, icone('busca', { tamanho: 16 }), busca), selStatus, selSo, total),
    barraLote, tabela);

  const aplicar = () => {
    filtro.q = busca.value.trim().toLowerCase();
    filtro.status = selStatus.value;
    filtro.so = selSo.value;
    desenhar();
  };
  busca.addEventListener('input', debounce(aplicar, 150));
  selStatus.addEventListener('change', aplicar);
  selSo.addEventListener('change', aplicar);

  function visiveis() {
    return agentes.filter((a) => (!filtro.status || a.status === filtro.status)
      && (!filtro.so || (a.so || '').toLowerCase() === filtro.so.toLowerCase())
      && (!filtro.q || [a.hostname, a.ip_local, a.usuario_logado, a.so_versao].some((v) => (v || '').toLowerCase().includes(filtro.q))));
  }

  function desenharLote() {
    barraLote.hidden = selecionados.size === 0;
    preencher(barraLote, 
      h('span', { text: `${selecionados.size} selecionado(s)` }),
      h('button', { class: 'btn btn-primario btn-pequeno', onclick: () => escolherScriptEExecutar(agentes.filter((a) => selecionados.has(a.id))) },
        icone('play', { tamanho: 14 }), 'Executar script'),
      h('button', { class: 'btn btn-pequeno', onclick: () => { selecionados.clear(); desenhar(); } }, 'Limpar seleção'));
  }

  function desenhar() {
    const lista = visiveis();
    total.textContent = `${lista.length} de ${agentes.length}`;
    if (!agentes.length) {
      preencher(tabela, vazio('Nenhum agente ainda', 'Gere um token de instalação e rode o comando no computador que deseja monitorar.',
        h('button', { class: 'btn btn-primario', onclick: adicionarAgente }, icone('mais', { tamanho: 16 }), 'Adicionar agente')));
      desenharLote();
      return;
    }
    const todos = h('input', { type: 'checkbox', 'aria-label': 'Selecionar todos os visíveis' });
    todos.checked = lista.length > 0 && lista.every((a) => selecionados.has(a.id));
    todos.addEventListener('change', () => {
      lista.forEach((a) => (todos.checked ? selecionados.add(a.id) : selecionados.delete(a.id)));
      desenhar();
    });
    preencher(tabela, h('table', { class: 'tabela tabela-agentes' },
      h('thead', {}, h('tr', {},
        h('th', { class: 'col-check' }, todos),
        h('th', { scope: 'col' }, 'Agente'), h('th', { scope: 'col' }, 'Status'),
        h('th', { scope: 'col', class: 'col-esconde-sm' }, 'IP'), h('th', { scope: 'col', class: 'col-esconde-sm' }, 'Usuário'),
        h('th', { scope: 'col' }, 'CPU'), h('th', { scope: 'col' }, 'RAM'), h('th', { scope: 'col', class: 'col-esconde-sm' }, 'Disco'),
        h('th', { scope: 'col', class: 'col-esconde-md' }, 'Último contato'), h('th', { scope: 'col' }, h('span', { class: 'sr' }, 'Ações')))),
      h('tbody', {}, lista.length ? lista.map(linha) : h('tr', {}, h('td', { colspan: 10, class: 'muted centro' }, 'Nenhum agente corresponde aos filtros.')))));
    desenharLote();
  }

  function linha(a) {
    const c = h('input', { type: 'checkbox', 'aria-label': `Selecionar ${a.hostname}` });
    c.checked = selecionados.has(a.id);
    c.addEventListener('change', () => { c.checked ? selecionados.add(a.id) : selecionados.delete(a.id); desenhar(); });
    const tr = h('tr', { class: ['linha-agente', selecionados.has(a.id) && 'selecionada'] },
      h('td', { class: 'col-check' }, c),
      h('td', {}, h('a', { class: 'link-agente', href: `#/agentes/${a.id}` }, h('strong', { text: a.hostname }),
        h('span', { class: 'muted', text: a.so_versao || a.so || '' })),
        a.alertas_abertos ? h('span', { class: 'selo selo-critico', title: 'Alertas abertos' }, icone('alertas', { tamanho: 12 }), String(a.alertas_abertos)) : null),
      h('td', {}, statusAgente(a.status)),
      h('td', { class: 'col-esconde-sm mono', text: a.ip_local || '—' }),
      h('td', { class: 'col-esconde-sm', text: a.usuario_logado || '—' }),
      h('td', {}, miniBarra(a.cpu_pct, 'CPU')),
      h('td', {}, miniBarra(ramPct(a), 'RAM')),
      h('td', { class: 'col-esconde-sm' }, miniBarra(a.disco_max_pct, 'Disco')),
      h('td', { class: 'col-esconde-md muted', title: a.ultimo_checkin ? new Date(a.ultimo_checkin).toLocaleString('pt-BR') : '' }, relativo(a.ultimo_checkin)),
      h('td', { class: 'col-acoes' },
        h('div', { class: 'acoes-rapidas' },
          h('button', { class: 'btn-icone', title: 'Executar script', 'aria-label': `Executar script em ${a.hostname}`, onclick: () => escolherScriptEExecutar([a]) }, icone('play', { tamanho: 16 })),
          h('a', { class: 'btn-icone', href: `#/agentes/${a.id}?aba=console`, title: 'Console', 'aria-label': `Abrir console de ${a.hostname}` }, icone('terminal', { tamanho: 16 })),
          h('a', { class: 'btn-icone', href: `#/agentes/${a.id}`, title: 'Detalhes', 'aria-label': `Detalhes de ${a.hostname}` }, icone('chevron', { tamanho: 16 })))));
    return tr;
  }

  async function carregar() {
    try {
      agentes = await get('/api/agentes');
      desenhar();
    } catch (e) { toastErro(e); }
  }
  carregar();

  const recarregar = debounce(carregar, 800);
  const cancelar = [
    aoEvento('checkin', (d) => {
      const a = agentes.find((x) => x.id === d.id);
      if (!a) return recarregar();
      Object.assign(a, d);
      desenhar();
    }),
    aoEvento('agente', recarregar),
    aoEvento('alerta', recarregar),
  ];
  const relogio = setInterval(desenhar, 30_000); // atualiza "há x min"
  return () => { cancelar.forEach((c) => c()); clearInterval(relogio); };
}

function select(rotulo, opcoes, valor) {
  const el = h('select', { class: 'input select', 'aria-label': rotulo },
    opcoes.map(([v, t]) => h('option', { value: v }, t)));
  el.value = valor;
  return el;
}
