// Módulo Alertas: página com filtros e resolução em massa, aba no dispositivo, widget por severidade,
// fonte do sino de notificações, contador no menu e seção "Regras de alerta" em Configurações.
import { h, preencher, debounce } from '../../nucleo/dom.js';
import { icone } from '../../nucleo/icones.js';
import { get, post, put, qs } from '../../nucleo/api.js';
import { estado, emitir, aoEvento, paramsEscopo, pode } from '../../nucleo/estado.js';
import { relativo, fmtData, fmtInt, normalizar } from '../../nucleo/formato.js';
import { cabecalhoPagina, chipsFiltro, busca, severidade, selo, vazio, skeleton, botao, interruptor, input, aviso, comCarregando } from '../../ui/componentes.js';
import { tabelaVirtual } from '../../ui/tabela-virtual.js';
import { composicao } from '../../ui/graficos.js';
import { toast, toastErro } from '../../ui/camadas.js';

const TIPOS = { cpu: 'CPU', ram: 'Memória', disco: 'Disco', offline: 'Offline' };
const nomeTipo = (t) => TIPOS[t] ?? t.replace(/^monitor:/, 'Monitor: ');

function duracao(ms) {
  const min = Math.round(ms / 60000);
  if (min < 1) return 'menos de 1 min';
  if (min < 60) return `${min} min`;
  if (min < 1440) return `${Math.floor(min / 60)} h ${min % 60} min`;
  return `${Math.floor(min / 1440)} d ${Math.floor((min % 1440) / 60)} h`;
}

async function atualizarContador() {
  try {
    const r = await get(`/api/alertas/resumo${qs(paramsEscopo())}`);
    if (estado.alertasAbertos !== r.abertos) { estado.alertasAbertos = r.abertos; emitir('contadores'); }
    return r;
  } catch { return null; }
}

async function resolver(ids) {
  let ok = 0;
  for (const id of ids) { try { await post(`/api/alertas/${id}/resolver`); ok++; } catch (e) { if (ids.length === 1) toastErro(e); } }
  if (ok) toast(ok === 1 ? 'Alerta resolvido.' : `${ok} alertas resolvidos.`, 'sucesso');
  atualizarContador();
}

function colunas({ comDispositivo = true } = {}) {
  return [
    { id: 'sev', rotulo: 'Severidade', largura: '112px', render: (a) => severidade(a.severidade), valor: (a) => ({ critico: 0, alerta: 1, info: 2 }[a.severidade]) },
    ...(comDispositivo ? [{ id: 'disp', rotulo: 'Dispositivo', largura: 'minmax(160px, 1fr)', render: (a) => h('div', { class: 'celula-duas-linhas' },
      h('a', { class: 'forte', href: `#/dispositivos/${a.agente_id}?aba=alertas`, text: a.hostname }), h('span', { class: 'sutil pequeno', text: a.site_nome })), valor: (a) => a.hostname }] : []),
    { id: 'tipo', rotulo: 'Tipo', largura: '110px', render: (a) => selo(nomeTipo(a.tipo), 'neutro'), valor: (a) => a.tipo },
    { id: 'msg', rotulo: 'Mensagem', largura: 'minmax(240px, 2fr)', render: (a) => h('span', { title: a.mensagem, text: a.mensagem }), valor: (a) => a.mensagem },
    { id: 'quando', rotulo: 'Aberto', largura: '130px', render: (a) => h('span', { class: 'muted', title: fmtData(a.aberto_em), text: relativo(a.aberto_em) }), valor: (a) => -a.aberto_em },
    { id: 'estado', rotulo: 'Estado', largura: '170px', render: (a) => (a.status === 'aberto'
      ? selo(`Aberto há ${duracao(Date.now() - a.aberto_em)}`, 'critico')
      : h('span', { class: 'sutil pequeno', title: a.resolvido_por ? `por ${a.resolvido_por}` : 'automaticamente', text: `Resolvido · durou ${duracao(a.resolvido_em - a.aberto_em)}` })), valor: (a) => (a.status === 'aberto' ? 0 : 1) },
    { id: 'acao', rotulo: '', rotuloAria: 'Ações', largura: '104px', ordenavel: false, render: (a) => (a.status === 'aberto' && pode('alertas.resolver')
      ? h('div', { class: 'acoes-linha' }, botao('Resolver', { tamanho: 'pequeno', icone: 'check', onclick: () => resolver([a.id]) })) : null) },
  ];
}

function paginaAlertas(raiz, { query }) {
  let status = query.get('status') || 'aberto';
  let sev = query.get('severidade') || '';
  let texto = '';
  let lista = [];
  const barraLote = h('div', { class: 'barra-lote', hidden: true, role: 'region', 'aria-label': 'Ações em massa' });
  const tabela = tabelaVirtual({
    rotulo: 'Alertas', chave: (a) => a.id, colunas: colunas(), selecionavel: pode('alertas.resolver'),
    ordem: { coluna: 'sev', direcao: 'asc' },
    aoAbrir: (a) => { location.hash = `#/dispositivos/${a.agente_id}?aba=alertas`; },
    aoSelecionar: (sel) => {
      const abertos = tabela.selecionadas().filter((a) => a.status === 'aberto');
      barraLote.hidden = !sel.size;
      preencher(barraLote, h('span', { class: 'contagem', text: `${fmtInt(sel.size)} selecionado(s)` }), h('span', { class: 'sep' }),
        botao(`Resolver ${abertos.length || ''}`.trim(), { icone: 'check', tamanho: 'pequeno', variante: 'primario', desabilitado: !abertos.length,
          onclick: async () => { await resolver(abertos.map((a) => a.id)); tabela.limparSelecao(); carregar(); } }),
        h('button', { class: 'btn-icone pequeno', 'aria-label': 'Limpar seleção', onclick: () => tabela.limparSelecao() }, icone('fechar')));
    },
    vazio: () => (status === 'aberto' && !texto && !sev
      ? vazio({ titulo: 'Nenhum alerta aberto', texto: 'Tudo tranquilo por aqui. Alertas aparecem quando uma regra é violada.', ilustracao: 'tudo-ok' })
      : vazio({ titulo: 'Nenhum alerta encontrado', texto: 'Ajuste os filtros.', ilustracao: 'busca', compacto: true })),
  });
  const campoBusca = busca('Buscar dispositivo ou mensagem…', { classe: 'cresce' });
  campoBusca.input.addEventListener('input', debounce(() => { texto = campoBusca.input.value; aplicar(); }, 120));
  const chipsStatus = chipsFiltro([{ id: 'aberto', rotulo: 'Abertos' }, { id: 'resolvido', rotulo: 'Resolvidos' }, { id: 'todos', rotulo: 'Todos' }],
    status, (v) => { status = v || 'todos'; carregar(); }, { rotulo: 'Estado' });
  const chipsSev = chipsFiltro([{ id: 'critico', rotulo: 'Crítico', icone: 'critico' }, { id: 'alerta', rotulo: 'Alerta', icone: 'aviso' }, { id: 'info', rotulo: 'Info', icone: 'info' }],
    sev, (v) => { sev = v; aplicar(); }, { rotulo: 'Severidade' });
  const corpo = h('div', {}, skeleton(6));
  raiz.append(
    cabecalhoPagina({ titulo: 'Alertas', migalhas: [['Monitoramento'], ['Alertas']], subtitulo: 'Gerados pelas regras de monitoramento; resolvem sozinhos quando a condição normaliza.',
      acoes: pode('alertas.ver') ? [botao('Regras de alerta', { icone: 'config', href: '#/configuracoes/alertas' })] : [] }),
    h('section', { class: 'cartao' }, h('div', { class: 'ferramentas' }, campoBusca.el, h('span', { class: 'espaco' }), chipsStatus, chipsSev), corpo),
    barraLote);

  const aplicar = () => {
    const t = normalizar(texto).split(/\s+/).filter(Boolean);
    tabela.definirLinhas(lista.filter((a) => (!sev || a.severidade === sev)
      && t.every((x) => normalizar(`${a.hostname} ${a.mensagem} ${a.tipo}`).includes(x))));
  };
  let primeira = true;
  async function carregar() {
    try {
      lista = await get(`/api/alertas${qs({ status, ...paramsEscopo() })}`);
      if (primeira) { preencher(corpo, tabela.el); primeira = false; }
      aplicar();
    } catch (e) { toastErro(e); }
  }
  carregar();
  const recarregar = debounce(carregar, 600);
  return aoEvento('alerta', recarregar);
}

function abaAlertas(el, { agente }) {
  const tabela = tabelaVirtual({ rotulo: 'Alertas do dispositivo', chave: (a) => a.id, colunas: colunas({ comDispositivo: false }), ordem: { coluna: 'quando', direcao: 'asc' },
    vazio: () => vazio({ titulo: 'Nenhum alerta neste dispositivo', texto: 'Quando uma regra for violada, o alerta aparece aqui.', ilustracao: 'tudo-ok', compacto: true }) });
  el.append(h('section', { class: 'cartao' }, tabela.el));
  const carregar = async () => { try { tabela.definirLinhas(await get(`/api/alertas?agente=${agente.id}&status=todos&limite=500`)); } catch (e) { toastErro(e); } };
  carregar();
  return aoEvento('alerta', (d) => { if (d.agente_id === agente.id) carregar(); });
}

function widgetSeveridade(el) {
  const corpo = h('div', { class: 'cartao-corpo' }, skeleton(4));
  el.append(h('header', { class: 'cartao-cabecalho' }, h('h2', { text: 'Alertas por severidade' }),
    h('a', { class: 'widget-acao', href: '#/alertas' }, 'Ver alertas', icone('chevron', { tamanho: 12 }))), corpo);
  const desenhar = async () => {
    const r = await atualizarContador();
    if (!r) return;
    const s = r.porSeveridade;
    preencher(corpo,
      h('div', { class: 'linha-entre mb-4' },
        h('div', { class: 'numero-heroi' }, fmtInt(r.abertos), h('small', { text: 'abertos' })),
        h('span', { class: 'sutil pequeno', text: `${fmtInt(r.ultimas24h)} nas últimas 24 h` })),
      r.abertos ? composicao([
        { rotulo: 'Crítico', valor: s.critico, cor: 'critico', href: '#/alertas?severidade=critico' },
        { rotulo: 'Alerta', valor: s.alerta, cor: 'aviso', href: '#/alertas?severidade=alerta' },
        { rotulo: 'Info', valor: s.info, cor: 'info', href: '#/alertas?severidade=info' },
      ], { rotulo: 'Alertas abertos por severidade' }) : h('p', { class: 'muted pequeno', text: 'Nenhum alerta aberto no escopo. Tudo tranquilo.' }),
      r.porTipo.length ? h('div', { class: 'chips mt-4' }, r.porTipo.slice(0, 5).map((t) => selo(`${nomeTipo(t.tipo)} · ${t.n}`, 'neutro'))) : null);
  };
  desenhar();
  return aoEvento('alerta', debounce(desenhar, 500));
}

function secaoRegras(el) {
  el.append(skeleton(6));
  get('/api/config').then((cfg) => {
    const r = cfg.regras;
    const podeEditar = pode('alertas.configurar');
    const campos = {};
    const regra = (chave, titulo, descricao, extras) => {
      const sw = interruptor(titulo, { marcado: r[chave].ativo });
      sw.input.disabled = !podeEditar;
      campos[chave] = { ativo: sw.input };
      return h('fieldset', { class: 'cartao', estilo: { padding: '16px' } },
        h('legend', { class: 'sr', text: titulo }),
        h('div', { class: 'linha-entre' }, sw.el),
        h('p', { class: 'sutil pequeno mt-1', text: descricao }),
        h('div', { class: 'linha mt-3' }, extras.map(([k, rotulo, min, max, sufixo]) => {
          const i = input({ tipo: 'number', classe: 'input-curto', valor: r[chave][k], attrs: { min, max, required: true, disabled: !podeEditar, 'aria-label': `${titulo}: ${rotulo}` } });
          campos[chave][k] = i;
          return h('label', { class: 'linha pequeno muted' }, rotulo, i, sufixo);
        })));
    };
    const webhook = input({ tipo: 'url', valor: cfg.webhook_url || '', placeholder: 'https://discord.com/api/webhooks/…', attrs: { maxlength: 500, disabled: !podeEditar, 'aria-label': 'URL do webhook' } });
    const salvar = botao('Salvar regras', { variante: 'primario', icone: 'check', tipo: 'submit', desabilitado: !podeEditar });
    const form = h('form', {
      class: 'pilha', onsubmit: (ev) => {
        ev.preventDefault();
        const ler = (k, n) => Number(campos[k][n].value);
        comCarregando(salvar, async () => {
          try {
            await put('/api/config', {
              regras: {
                cpu: { ativo: campos.cpu.ativo.checked, limite: ler('cpu', 'limite'), ciclos: ler('cpu', 'ciclos') },
                ram: { ativo: campos.ram.ativo.checked, limite: ler('ram', 'limite'), ciclos: ler('ram', 'ciclos') },
                disco: { ativo: campos.disco.ativo.checked, limite: ler('disco', 'limite') },
                offline: { ativo: campos.offline.ativo.checked, minutos: ler('offline', 'minutos') },
              },
              webhook_url: webhook.value.trim(),
            });
            toast('Regras salvas.', 'sucesso');
          } catch (e) { toastErro(e); }
        });
      },
    },
    podeEditar ? null : aviso('Somente administradores alteram as regras.', 'info'),
    h('div', { class: 'grade-2' },
      regra('cpu', 'CPU alta', 'Abre quando a CPU passa do limite por vários check-ins seguidos (cada check-in ≈ 15 s).', [['limite', 'Acima de', 1, 100, '%'], ['ciclos', 'por', 1, 100, 'check-ins']]),
      regra('ram', 'Memória alta', 'Uso de RAM acima do limite por vários check-ins seguidos.', [['limite', 'Acima de', 1, 100, '%'], ['ciclos', 'por', 1, 100, 'check-ins']]),
      regra('disco', 'Disco cheio', 'Qualquer volume acima do limite. Acima de 95% vira crítico.', [['limite', 'Acima de', 1, 100, '%']]),
      regra('offline', 'Dispositivo offline', 'Sem check-in pelo tempo definido. O dispositivo aparece como offline após 60 s.', [['minutos', 'Por mais de', 1, 10080, 'min']])),
    h('div', { class: 'cartao', estilo: { padding: '16px' } },
      h('h3', { text: 'Webhook' }), h('p', { class: 'sutil pequeno mt-1 mb-3', text: 'POST JSON quando um alerta abre. Compatível com Discord (content), Slack (text) e ntfy.' }),
      h('div', { class: 'linha' }, h('div', { class: 'cresce' }, webhook),
        botao('Testar', { icone: 'raio', desabilitado: !podeEditar, onclick: async () => {
          try { await put('/api/config', { regras: (await get('/api/config')).regras, webhook_url: webhook.value.trim() }); await post('/api/config/webhook-teste'); toast('O webhook respondeu com sucesso.', 'sucesso'); } catch (e) { toastErro(e); }
        } }))),
    h('div', { class: 'linha' }, salvar));
    preencher(el, form);
  }).catch(toastErro);
}

export default {
  nome: 'alertas',
  iniciar(farol) {
    farol.menu({ id: 'alertas', rotulo: 'Alertas', icone: 'alertas', secao: 'Monitoramento', ordem: 10, href: '#/alertas', permissao: 'alertas.ver', contador: () => estado.alertasAbertos });
    farol.rota('/alertas', { titulo: 'Alertas', permissao: 'alertas.ver', render: paginaAlertas });
    farol.abaDispositivo({ id: 'alertas', rotulo: 'Alertas', icone: 'alertas', ordem: 60, permissao: 'alertas.ver', render: abaAlertas, contagem: (a) => a.alertas_abertos });
    farol.colunaDispositivo({ id: 'alertas', rotulo: 'Alertas', largura: '96px', ordem: 100,
      render: (a) => (a.alertas_abertos ? h('a', { href: `#/dispositivos/${a.id}?aba=alertas` }, selo(String(a.alertas_abertos), a.alerta_severidade === 'critico' ? 'critico' : 'aviso', { icone: a.alerta_severidade === 'critico' ? 'critico' : 'aviso' })) : h('span', { class: 'sutil', text: '—' })),
      valor: (a) => -(a.alertas_abertos ?? 0) });
    farol.widget({ id: 'alertas', titulo: 'Alertas por severidade', ordem: 20, tamanho: 4, permissao: 'alertas.ver', render: widgetSeveridade });
    farol.secaoConfig({ id: 'alertas', rotulo: 'Regras de alerta', descricao: 'Limites de CPU, memória, disco e offline, e o webhook.', icone: 'alertas', ordem: 40, permissao: 'alertas.ver', render: secaoRegras });
    farol.notificacoes({
      id: 'alertas', permissao: 'alertas.ver', eventos: ['alerta'], href: '#/alertas',
      contar: async () => (await atualizarContador())?.abertos ?? 0,
      listar: async () => (await get(`/api/alertas${qs({ status: 'aberto', limite: 8, ...paramsEscopo() })}`)).map((a) => ({
        titulo: `${a.hostname} · ${nomeTipo(a.tipo)}`, texto: a.mensagem, quando: a.aberto_em, href: `#/dispositivos/${a.agente_id}?aba=alertas`,
        icone: a.severidade === 'critico' ? 'critico' : a.severidade === 'alerta' ? 'aviso' : 'info', tom: a.severidade,
      })),
    });
    farol.comando({ id: 'alertas-criticos', rotulo: 'Ver alertas críticos', icone: 'critico', palavras: 'problemas incidentes', permissao: 'alertas.ver', executar: () => { location.hash = '#/alertas?severidade=critico'; } });
    aoEvento('alerta', (a) => {
      if (a.status === 'aberto' && !a.atualizado && a.severidade === 'critico') toast(`${a.hostname ?? 'Dispositivo'}: ${a.mensagem}`, 'erro', { titulo: 'Alerta crítico' });
    });
    aoEvento('escopo', atualizarContador);
  },
};
