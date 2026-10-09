// Módulo Dispositivos: lista, detalhe (Resumo, Monitoramento, Inventário, Software), colunas da lista,
// ações (reiniciar, desligar, mover, revogar…), widgets do painel, busca na paleta e instalação do agente.
import { h, preencher } from '../../nucleo/dom.js';
import { icone } from '../../nucleo/icones.js';
import { get, post, put, qs } from '../../nucleo/api.js';
import { estado, paramsEscopo, aoEvento } from '../../nucleo/estado.js';
import { relativo, ramPct, fmtInt, normalizar } from '../../nucleo/formato.js';
import { estadoDispositivo, medidor, selo, skeleton, vazio, select, campo, cartao, estatistica } from '../../ui/componentes.js';
import { composicao, barras } from '../../ui/graficos.js';
import { modal, confirmar, toast, toastErro } from '../../ui/camadas.js';
import { comElevacao } from '../../ui/elevar.js';
import { abrirMenu } from '../../ui/flutuante.js';
import { paginaLista } from './lista.js';
import { paginaDetalhe } from './detalhe.js';
import { abaResumo, abaMonitoramento, abaInventario, abaSoftware } from './abas.js';
import { adicionarDispositivo } from './instalar.js';
import { celulaDispositivo, listarDispositivos, nomeSo, invalidarCache } from './comum.js';
import { itensAcoes } from './acoes.js';

let resumoCache = { chave: '', em: 0, p: null };
function resumo() {
  const chave = qs(paramsEscopo());
  if (resumoCache.p && resumoCache.chave === chave && Date.now() - resumoCache.em < 3000) return resumoCache.p;
  resumoCache = { chave, em: Date.now(), p: get(`/api/resumo${chave}`) };
  return resumoCache.p;
}

function escolherSite(titulo, aoEscolher) {
  const opcoes = estado.clientes.flatMap((c) => c.sites.map((s) => [s.id, `${c.nome} · ${s.nome}`]));
  modal({
    titulo, largura: 'sm', icone: 'mover',
    conteudo: (fechar) => {
      const sel = select(opcoes);
      return [campo('Site de destino', sel), h('div', { class: 'modal-acoes' },
        h('button', { class: 'btn', type: 'button', onclick: () => fechar() }, 'Cancelar'),
        h('button', { class: 'btn btn-primario', type: 'button', onclick: async () => { fechar(); await aoEscolher(Number(sel.value)); } }, 'Mover'))];
    },
  });
}

async function energia(agente, acao) {
  const ok = await confirmar({
    titulo: acao === 'reiniciar' ? `Reiniciar ${agente.hostname}?` : `Desligar ${agente.hostname}?`,
    mensagem: acao === 'reiniciar'
      ? 'O computador reinicia em cerca de 10 segundos. Trabalho não salvo de quem estiver usando será perdido.'
      : 'O computador desliga em cerca de 10 segundos e só volta se alguém ligá-lo (ou por Wake-on-LAN).',
    rotulo: acao === 'reiniciar' ? 'Reiniciar' : 'Desligar', perigo: true, icone: 'energia',
  });
  if (!ok) return;
  const r = await comElevacao(`${acao === 'reiniciar' ? 'Reiniciar' : 'Desligar'} ${agente.hostname}.`,
    () => post(`/api/agentes/${agente.id}/energia`, { acao }));
  if (r) toast(r.status === 'pendente' ? 'O dispositivo não está em tempo real: o comando segue no próximo check-in.' : `Comando enviado: ${acao === 'reiniciar' ? 'reiniciando' : 'desligando'} em ~10 s.`, 'sucesso');
}

export default {
  nome: 'dispositivos',
  iniciar(farol) {
    farol.menu({ id: 'dispositivos', rotulo: 'Dispositivos', icone: 'dispositivos', secao: 'Gerenciar', ordem: 10, href: '#/dispositivos', permissao: 'dispositivos.ver' });
    farol.rota('/dispositivos', { titulo: 'Dispositivos', permissao: 'dispositivos.ver', render: paginaLista });
    farol.rota('/dispositivos/:id', { titulo: 'Dispositivo', permissao: 'dispositivos.ver', menu: 'dispositivos', render: paginaDetalhe });

    // ---------- abas ----------
    farol.abaDispositivo({ id: 'resumo', rotulo: 'Resumo', icone: 'painel', ordem: 10, render: abaResumo });
    farol.abaDispositivo({ id: 'monitoramento', rotulo: 'Monitoramento', icone: 'pulso', ordem: 20, render: abaMonitoramento });
    farol.abaDispositivo({ id: 'inventario', rotulo: 'Inventário', icone: 'cpu', ordem: 30, render: abaInventario });
    farol.abaDispositivo({ id: 'software', rotulo: 'Software', icone: 'pacote', ordem: 40, render: abaSoftware, contagem: (a) => a.inventario?.softwares?.length });

    // ---------- colunas da lista ----------
    const col = (def) => farol.colunaDispositivo(def);
    col({ id: 'status', rotulo: 'Status', largura: '96px', ordem: 10, render: (a) => estadoDispositivo(a.status), valor: (a) => ({ online: 0, pendente: 1, offline: 2 }[a.status] ?? 3) });
    col({ id: 'dispositivo', rotulo: 'Dispositivo', largura: 'minmax(190px, 1.5fr)', ordem: 20, fixa: true, render: celulaDispositivo, valor: (a) => a.hostname.toLowerCase() });
    col({ id: 'site', rotulo: 'Cliente · site', largura: 'minmax(130px, 1fr)', ordem: 30, render: (a) => h('div', { class: 'celula-duas-linhas' }, h('span', { text: a.site_nome }), h('span', { class: 'sub sutil pequeno', text: a.cliente_nome })), valor: (a) => `${a.cliente_nome} ${a.site_nome}` });
    col({ id: 'so', rotulo: 'Sistema', largura: 'minmax(130px, 1fr)', ordem: 40, render: (a) => h('span', { class: 'muted', title: a.so_versao ?? '', text: nomeSo(a) }), valor: (a) => nomeSo(a) });
    col({ id: 'usuario', rotulo: 'Usuário', largura: '120px', ordem: 50, padrao: false, render: (a) => h('span', { class: 'muted', text: a.usuario_logado || '—' }), valor: (a) => a.usuario_logado });
    col({ id: 'ip', rotulo: 'IP', largura: '128px', ordem: 55, padrao: false, render: (a) => h('span', { class: 'mono pequeno', text: a.ip_local || '—' }), valor: (a) => a.ip_local });
    col({ id: 'contato', rotulo: 'Contato', largura: '100px', ordem: 60, render: (a) => h('span', { class: 'muted', title: a.ultimo_checkin ? new Date(a.ultimo_checkin).toLocaleString('pt-BR') : '', text: relativo(a.ultimo_checkin) }), valor: (a) => -(a.ultimo_checkin ?? 0) });
    col({ id: 'cpu', rotulo: 'CPU', largura: '92px', ordem: 70, render: (a) => medidor(a.status === 'online' ? a.cpu_pct : null, 'CPU'), valor: (a) => a.cpu_pct });
    col({ id: 'ram', rotulo: 'RAM', largura: '92px', ordem: 80, render: (a) => medidor(a.status === 'online' ? ramPct(a) : null, 'RAM'), valor: (a) => ramPct(a) });
    col({ id: 'disco', rotulo: 'Disco', largura: '92px', ordem: 90, render: (a) => medidor(a.disco_max_pct, 'Disco'), valor: (a) => a.disco_max_pct });
    // Placeholder até o módulo de patches existir: ele registra uma coluna própria (patch_status) e esta some.
    col({ id: 'patches', rotulo: 'Patches', largura: '104px', ordem: 95, render: (a) => (a.patch_status ? selo(a.patch_status, 'info') : h('span', { class: 'sutil pequeno', 'data-dica': 'Gestão de patches chega em breve', text: 'Não avaliado' })), valor: (a) => a.patch_status });
    col({ id: 'versao', rotulo: 'Agente', largura: '90px', ordem: 120, padrao: false, render: (a) => h('span', { class: 'mono pequeno sutil', text: a.versao_agente ? `v${a.versao_agente}` : '—' }), valor: (a) => a.versao_agente });
    col({ id: 'acoes', rotulo: '', rotuloAria: 'Ações', largura: '72px', ordem: 999, fixa: true, ordenavel: false, render: (a) => {
      const mais = h('button', { class: 'btn-icone pequeno', 'aria-label': `Ações de ${a.hostname}`, 'data-dica': 'Ações', onclick: (ev) => abrirMenu(ev.currentTarget, itensAcoes(a), { alinhar: 'fim', rotulo: 'Ações' }) }, icone('reticencias'));
      return h('div', { class: 'acoes-linha' }, h('a', { class: 'btn-icone pequeno', href: `#/dispositivos/${a.id}`, 'aria-label': `Abrir ${a.hostname}`, 'data-dica': 'Abrir' }, icone('chevron')), mais);
    } });

    // ---------- ações ----------
    farol.acaoDispositivo({ id: 'terminal', rotulo: 'Terminal', icone: 'terminal', ordem: 20, emBreve: true, permissao: 'dispositivos.ver' });
    farol.acaoDispositivo({ id: 'tela', rotulo: 'Tela remota', icone: 'tela', ordem: 30, emBreve: true, permissao: 'dispositivos.ver' });
    farol.acaoDispositivo({ id: 'mover', rotulo: 'Mover para outro site', icone: 'mover', ordem: 60, menu: true, permissao: 'dispositivos.editar',
      executar: (a, ctx) => escolherSite(`Mover ${a.hostname}`, async (site) => {
        try { await put(`/api/agentes/${a.id}`, { site_id: site }); toast('Dispositivo movido.', 'sucesso'); invalidarCache(); ctx?.recarregar?.(); } catch (e) { toastErro(e); }
      }) });
    farol.acaoDispositivo({ id: 'reiniciar', rotulo: 'Reiniciar', icone: 'reiniciar', ordem: 80, menu: true, perigo: true, permissao: 'dispositivos.energia', disponivel: (a) => a.status === 'online', executar: (a) => energia(a, 'reiniciar') });
    farol.acaoDispositivo({ id: 'desligar', rotulo: 'Desligar', icone: 'energia', ordem: 81, menu: true, perigo: true, permissao: 'dispositivos.energia', disponivel: (a) => a.status === 'online', executar: (a) => energia(a, 'desligar') });
    farol.acaoDispositivo({ id: 'revogar', rotulo: 'Revogar dispositivo', icone: 'revogar', ordem: 99, menu: true, perigo: true, permissao: 'dispositivos.revogar',
      executar: async (a) => {
        const ok = await confirmar({ titulo: `Revogar ${a.hostname}?`, perigo: true, rotulo: 'Revogar', digitar: a.hostname,
          mensagem: 'O agente perde o acesso na hora e sai da lista. Execuções pendentes são canceladas. Para voltar, será preciso reinstalar com um token novo.' });
        if (!ok) return;
        try { await post(`/api/agentes/${a.id}/revogar`); toast('Dispositivo revogado.', 'sucesso'); invalidarCache(); location.hash = '#/dispositivos'; } catch (e) { toastErro(e); }
      } });
    farol.acaoLote({ id: 'mover', rotulo: 'Mover para site', icone: 'mover', ordem: 50, permissao: 'dispositivos.editar',
      executar: (sel, ctx) => escolherSite(`Mover ${sel.length} dispositivo(s)`, async (site) => {
        try { const r = await post('/api/agentes/mover', { agentes: sel.map((a) => a.id), site_id: site }); toast(`${r.movidos} dispositivo(s) movido(s).`, 'sucesso'); ctx?.recarregar?.(); } catch (e) { toastErro(e); }
      }) });

    // ---------- widgets ----------
    farol.widget({ id: 'frota', titulo: 'Estado da frota', ordem: 10, tamanho: 4, permissao: 'dispositivos.ver', render: widgetFrota });
    farol.widget({ id: 'disco', titulo: 'Saúde de disco', ordem: 30, tamanho: 4, permissao: 'dispositivos.ver', render: widgetDisco });
    farol.widget({ id: 'sistemas', titulo: 'Sistemas operacionais', ordem: 50, tamanho: 4, permissao: 'dispositivos.ver', render: widgetSistemas });
    farol.widget({ id: 'maior-uso', titulo: 'Maior uso de recursos', ordem: 40, tamanho: 8, permissao: 'dispositivos.ver', render: widgetMaiorUso });

    // ---------- paleta ----------
    farol.comando({ id: 'adicionar-dispositivo', rotulo: 'Adicionar dispositivo', descricao: 'Gerar token de instalação do agente', icone: 'mais', palavras: 'instalar agente token novo', permissao: 'dispositivos.instalar', executar: adicionarDispositivo });
    farol.comando({ id: 'dispositivos-offline', rotulo: 'Ver dispositivos offline', icone: 'dispositivos', palavras: 'desligados sem contato', permissao: 'dispositivos.ver', executar: () => { location.hash = '#/dispositivos?filtro=offline'; } });
    farol.buscador({ id: 'dispositivos', secao: 'Dispositivos', ordem: 10, permissao: 'dispositivos.ver', buscar: async (q) => {
      const t = normalizar(q).split(/\s+/).filter(Boolean);
      return (await listarDispositivos()).filter((a) => { const alvo = normalizar(`${a.hostname} ${a.ip_local} ${a.usuario_logado} ${a.descricao}`); return t.every((x) => alvo.includes(x)); })
        .map((a) => ({ rotulo: a.hostname, descricao: `${a.status === 'online' ? 'Online' : 'Offline'} · ${a.site_nome} · ${a.ip_local ?? nomeSo(a)}`, icone: 'dispositivos', href: `#/dispositivos/${a.id}` }));
    } });
  },
};

// ------------------------------------------------------------------ widgets
function corpoWidget(el, titulo, link) {
  const corpo = h('div', { class: 'cartao-corpo' }, skeleton(4));
  el.append(h('header', { class: 'cartao-cabecalho' }, h('h2', { text: titulo }), link ? h('a', { class: 'widget-acao', href: link[1] }, link[0], icone('chevron', { tamanho: 12 })) : null), corpo);
  return corpo;
}

function vivo(fn) {
  let t;
  const parar = ['checkin', 'agente'].map((ev) => aoEvento(ev, () => { clearTimeout(t); t = setTimeout(fn, 4000); }));
  return () => { parar.forEach((p) => p()); clearTimeout(t); };
}

function widgetFrota(el) {
  const corpo = corpoWidget(el, 'Estado da frota', ['Ver todos', '#/dispositivos']);
  const desenhar = async () => {
    try {
      const r = await resumo();
      preencher(corpo,
        h('div', { class: 'linha-entre mb-4' },
          h('div', { class: 'numero-heroi' }, fmtInt(r.total), h('small', { text: r.total === 1 ? 'dispositivo' : 'dispositivos' })),
          r.tempoReal ? selo(`${fmtInt(r.tempoReal)} em tempo real`, 'marca', { icone: 'raio' }) : null),
        composicao([
          { rotulo: 'Online', valor: r.online, cor: 'ok', href: '#/dispositivos?filtro=online' },
          { rotulo: 'Offline', valor: r.offline, cor: 'neutro', href: '#/dispositivos?filtro=offline' },
          { rotulo: 'Aguardando', valor: r.pendente, cor: 'aviso', href: '#/dispositivos?filtro=pendente' },
        ], { rotulo: 'Estado dos dispositivos' }));
    } catch (e) { toastErro(e); }
  };
  desenhar();
  return vivo(() => { resumoCache.em = 0; desenhar(); });
}

function widgetDisco(el) {
  const corpo = corpoWidget(el, 'Saúde de disco');
  const desenhar = async () => {
    try {
      const { disco: d, total } = await resumo();
      const criticos = d.critico;
      preencher(corpo,
        h('div', { class: 'mb-4' }, h('div', { class: 'numero-heroi' }, fmtInt(criticos), h('small', { text: 'acima de 90%' })),
          h('p', { class: 'sutil pequeno mt-1', text: total ? `${Math.round(((total - criticos - d.alerta) / total) * 100)}% da frota com folga de disco` : 'Sem dispositivos no escopo' })),
        composicao([
          { rotulo: 'Saudável (<75%)', valor: d.ok, cor: 'ok' },
          { rotulo: 'Atenção (75–90%)', valor: d.alerta, cor: 'aviso' },
          { rotulo: 'Crítico (≥90%)', valor: d.critico, cor: 'critico' },
          { rotulo: 'Sem dado', valor: d.sem_dado, cor: 'neutro' },
        ], { rotulo: 'Uso do disco mais cheio de cada dispositivo' }));
    } catch (e) { toastErro(e); }
  };
  desenhar();
  return vivo(() => { resumoCache.em = 0; desenhar(); });
}

function widgetSistemas(el) {
  const corpo = corpoWidget(el, 'Sistemas operacionais');
  resumo().then((r) => {
    if (!r.sistemas.length) { preencher(corpo, vazio({ titulo: 'Sem dispositivos', compacto: true, ilustracao: 'caixa' })); return; }
    const nomes = { Windows: 'Windows', Linux: 'Linux', Darwin: 'macOS' };
    const ics = { Windows: 'windows', Linux: 'linux', Darwin: 'apple' };
    preencher(corpo, barras(r.sistemas.slice(0, 6).map((s) => ({ rotulo: nomes[s.so] ?? s.so, valor: s.n, icone: icone(ics[s.so] ?? 'dispositivos', { tamanho: 14 }),
      href: `#/dispositivos?filtro=${{ Windows: 'windows', Linux: 'linux', Darwin: 'macos' }[s.so] ?? ''}` }))));
  }).catch(toastErro);
}

function widgetMaiorUso(el) {
  const corpo = corpoWidget(el, 'Maior uso de recursos', ['Dispositivos', '#/dispositivos']);
  corpo.classList.add('sem-padding');
  const desenhar = async () => {
    try {
      const r = await resumo();
      preencher(corpo, r.piores.length ? h('ul', { class: 'lista-linhas' }, r.piores.map((a) => h('li', {},
        h('a', { class: 'linha-item', href: `#/dispositivos/${a.id}` },
          h('div', { class: 'linha-texto' }, h('span', { class: 'forte', text: a.hostname }), h('small', { text: `${a.site_nome} · ${nomeSo(a)}` })),
          h('div', { class: 'uso-trio' }, medidor(a.cpu_pct, 'CPU', { rotulo: true }), medidor(ramPct(a), 'RAM', { rotulo: true }), medidor(a.disco_max_pct, 'Disco', { rotulo: true }))))))
        : vazio({ titulo: 'Nenhum dispositivo online', texto: 'Quando houver dispositivos conectados, os mais carregados aparecem aqui.', compacto: true }));
    } catch (e) { toastErro(e); }
  };
  desenhar();
  return vivo(() => { resumoCache.em = 0; desenhar(); });
}

export { cartao, estatistica };
