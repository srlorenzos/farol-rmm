// Visão geral: cartões de totais, agentes com maior uso e últimas execuções.
import { h, preencher, relativo, ramPct } from '../util.js';
import { get } from '../api.js';
import { cabecalhoPagina, skeleton, miniBarra, statusJob, vazio, toastErro } from '../ui.js';
import { aoEvento } from '../estado.js';

export function render(raiz) {
  const cartoes = h('section', { class: 'cartoes', 'aria-label': 'Resumo' }, [0, 1, 2, 3].map(() => h('div', { class: 'cartao-numero' }, skeleton(2))));
  const piores = h('section', { class: 'painel-bloco' }, h('h2', { text: 'Maior uso de recursos' }), skeleton(5));
  const execucoes = h('section', { class: 'painel-bloco' }, h('h2', { text: 'Últimas execuções' }), skeleton(5));
  raiz.append(cabecalhoPagina('Visão geral', 'Estado atual dos computadores monitorados'), cartoes, h('div', { class: 'grade-2' }, piores, execucoes));

  let carregando = false;
  async function carregar() {
    if (carregando) return;
    carregando = true;
    try {
      const r = await get('/api/resumo');
      preencher(cartoes, 
        cartao('Agentes', r.total, 'agentes', '#/agentes'),
        cartao('Online', r.online, 'ok', '#/agentes?status=online'),
        cartao('Offline', r.offline, r.offline ? 'alerta' : 'neutro', '#/agentes?status=offline'),
        cartao('Alertas abertos', r.alertasAbertos, r.alertasAbertos ? 'critico' : 'neutro', '#/alertas'));
      preencher(piores, h('h2', { text: 'Maior uso de recursos' }),
        r.piores.length ? h('ul', { class: 'lista-uso' }, r.piores.map(itemUso))
          : vazio('Nenhum agente online', 'Cadastre um agente em Agentes → Adicionar.'));
      preencher(execucoes, h('h2', { text: 'Últimas execuções' }),
        r.execucoes.length ? h('ul', { class: 'lista-exec' }, r.execucoes.map(itemExec))
          : vazio('Nenhum script executado ainda', 'Abra Scripts para rodar um dos exemplos.'));
    } catch (e) {
      toastErro(e);
    } finally {
      carregando = false;
    }
  }
  carregar();

  // Atualiza em tempo real, sem martelar a API: no máx. uma vez a cada 3 s.
  let agendado = null;
  const agendar = () => { if (!agendado) agendado = setTimeout(() => { agendado = null; carregar(); }, 3000); };
  const cancelar = ['checkin', 'agente', 'job', 'alerta'].map((t) => aoEvento(t, agendar));
  return () => { cancelar.forEach((c) => c()); clearTimeout(agendado); };
}

function cartao(rotulo, valor, tom, href) {
  return h('a', { class: `cartao-numero tom-${tom}`, href },
    h('span', { class: 'cartao-rotulo', text: rotulo }),
    h('span', { class: 'cartao-valor', text: String(valor) }));
}

function itemUso(a) {
  return h('li', {},
    h('a', { class: 'item-uso', href: `#/agentes/${a.id}` },
      h('span', { class: 'item-uso-nome' }, h('strong', { text: a.hostname }), h('span', { class: 'muted', text: a.so_versao || a.so || '' })),
      h('span', { class: 'item-uso-barras' },
        miniBarra(a.cpu_pct, 'CPU', { comRotulo: true }), miniBarra(ramPct(a), 'RAM', { comRotulo: true }), miniBarra(a.disco_max_pct, 'Disco', { comRotulo: true }))));
}

function itemExec(j) {
  return h('li', { class: 'item-exec' },
    h('span', { class: 'item-exec-nome' },
      h('strong', { text: j.nome }),
      h('span', { class: 'muted' }, h('a', { href: `#/agentes/${j.agente_id}`, text: j.hostname }), ` · ${j.criado_por} · ${relativo(j.criado_em)}`)),
    statusJob(j.status));
}

