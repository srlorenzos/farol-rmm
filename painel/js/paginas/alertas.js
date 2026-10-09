// Alertas abertos e resolvidos.
import { h, icone, preencher, relativo, fmtData } from '../util.js';
import { get, post } from '../api.js';
import { cabecalhoPagina, skeleton, vazio, toastErro, toast } from '../ui.js';
import { aoEvento } from '../estado.js';

const TIPOS = { cpu: 'CPU', ram: 'Memória', disco: 'Disco', offline: 'Offline' };

export function render(raiz, { query }) {
  let status = query.get('status') || 'aberto';
  const seletor = h('div', { class: 'segmentado', role: 'group', 'aria-label': 'Filtrar alertas' });
  const lista = h('div', {}, skeleton(5));
  raiz.append(
    cabecalhoPagina('Alertas', 'Gerados pelas regras definidas em Configurações',
      h('a', { class: 'btn', href: '#/config' }, icone('config', { tamanho: 16 }), 'Regras')),
    h('div', { class: 'filtros' }, seletor), lista);

  function desenharSeletor() {
    preencher(seletor, [['aberto', 'Abertos'], ['resolvido', 'Resolvidos'], ['todos', 'Todos']].map(([v, t]) =>
      h('button', { class: 'segmento', type: 'button', 'aria-pressed': String(v === status), onclick: () => { status = v; desenharSeletor(); carregar(); } }, t)));
  }

  async function carregar() {
    try {
      const alertas = await get(`/api/alertas?status=${status}`);
      preencher(lista, alertas.length
        ? h('ul', { class: 'lista-alertas' }, alertas.map(item))
        : vazio(status === 'aberto' ? 'Nenhum alerta aberto' : 'Nenhum alerta', status === 'aberto' ? 'Tudo tranquilo por aqui.' : null));
    } catch (e) { toastErro(e); }
  }

  function item(a) {
    const aberto = a.status === 'aberto';
    return h('li', { class: ['alerta', aberto ? 'alerta-aberto' : 'alerta-resolvido'] },
      h('span', { class: 'alerta-icone' }, icone(aberto ? 'aviso' : 'check', { tamanho: 18 })),
      h('div', { class: 'alerta-texto' },
        h('div', {}, h('span', { class: 'selo', text: TIPOS[a.tipo] ?? a.tipo }), ' ',
          h('a', { href: `#/agentes/${a.agente_id}`, text: a.hostname }), ' ', h('span', { text: a.mensagem })),
        h('p', { class: 'muted pequeno', title: fmtData(a.aberto_em) },
          aberto ? `Aberto ${relativo(a.aberto_em)}` : `Resolvido ${relativo(a.resolvido_em)} · durou ${duracao(a.resolvido_em - a.aberto_em)}`)),
      h('span', { class: `selo ${aberto ? 'selo-critico' : 'selo-ok'}`, text: aberto ? 'Aberto' : 'Resolvido' }),
      aberto ? h('button', {
        class: 'btn btn-pequeno', onclick: async () => {
          try { await post(`/api/alertas/${a.id}/resolver`); toast('Alerta marcado como resolvido.', 'sucesso'); carregar(); } catch (e) { toastErro(e); }
        },
      }, 'Resolver') : null);
  }

  desenharSeletor();
  carregar();
  const cancelar = aoEvento('alerta', carregar);
  return cancelar;
}

function duracao(ms) {
  const min = Math.round(ms / 60000);
  if (min < 1) return 'menos de 1 min';
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${min % 60} min`;
}
