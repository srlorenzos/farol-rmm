// Detalhe do dispositivo: cabeçalho com estado e ações rápidas + abas registradas pelos módulos.
import { h, preencher, limpar } from '../../nucleo/dom.js';
import { icone } from '../../nucleo/icones.js';
import { get } from '../../nucleo/api.js';
import { aoEvento } from '../../nucleo/estado.js';
import { registro, visiveis } from '../../nucleo/registro.js';
import { relativo, fmtDuracao, soChave } from '../../nucleo/formato.js';
import { migalhasEl, botao, estadoDispositivo, selo, skeleton, vazio, abas } from '../../ui/componentes.js';
import { botaoMenu } from '../../ui/flutuante.js';
import { acoesDisponiveis } from './acoes.js';
import { nomeSo } from './comum.js';

export function paginaDetalhe(raiz, { params, query }) {
  const id = params.id;
  let agente = null;
  let abaAtual = query.get('aba') || null;
  let limpezaAba = null;

  const cabecalho = h('header', { class: 'cabecalho-dispositivo' }, h('div', { class: 'cresce' }, skeleton(2, { alto: true })));
  const barraAbas = h('div', {});
  const painelAba = h('div', { class: 'aba-painel', role: 'tabpanel' });
  raiz.append(migalhasEl([['Dispositivos', '#/dispositivos'], ['…']]), cabecalho, barraAbas, painelAba);

  const abasVisiveis = () => visiveis(registro.abasDispositivo).filter((a) => !a.disponivel || a.disponivel(agente));

  function desenharCabecalho() {
    const a = agente;
    document.title = `${a.hostname} · Farol`;
    preencher(raiz.querySelector('.migalhas'), ...migalhasEl([['Dispositivos', '#/dispositivos'], [a.cliente_nome, null], [a.site_nome, null], [a.hostname]]).childNodes);
    const so = soChave(a.so);
    const acoes = acoesDisponiveis(a);
    const rapidas = acoes.filter((x) => !x.menu);
    const noMenu = acoes.filter((x) => x.menu);
    preencher(cabecalho,
      h('div', { class: 'identidade' },
        h('div', { class: 'avatar-dispositivo', 'aria-hidden': 'true' }, icone(so === 'windows' ? 'windows' : so === 'macos' ? 'apple' : so === 'linux' ? 'linux' : 'dispositivos')),
        h('div', { class: 'cresce' },
          h('h1', {}, h('span', { text: a.hostname }), estadoDispositivo(a.status),
            a.tempo_real ? selo('Tempo real', 'marca', { icone: 'raio', dica: 'Canal em tempo real conectado' }) : null,
            a.alertas_abertos ? h('a', { href: `#/dispositivos/${a.id}?aba=alertas` }, selo(`${a.alertas_abertos} alerta(s)`, 'critico', { icone: 'alertas' })) : null),
          h('div', { class: 'meta' },
            h('span', {}, icone('dispositivos'), nomeSo(a)),
            h('span', {}, icone('site'), `${a.cliente_nome} · ${a.site_nome}`),
            a.ip_local ? h('span', { class: 'mono' }, icone('rede'), a.ip_local) : null,
            a.usuario_logado ? h('span', {}, icone('usuario'), a.usuario_logado) : null,
            a.uptime != null ? h('span', {}, icone('energia'), `Ligado há ${fmtDuracao(a.uptime)}`) : null,
            h('span', { title: a.ultimo_checkin ? new Date(a.ultimo_checkin).toLocaleString('pt-BR') : '' }, icone('relogio'), `Contato ${relativo(a.ultimo_checkin)}`)))),
      a.revogado ? selo('Revogado', 'critico') : h('div', { class: 'pagina-acoes' },
        rapidas.map((x) => botao(x.rotulo, { icone: x.icone, variante: x.primaria ? 'primario' : x.perigo ? 'perigo-sutil' : null, emBreve: x.emBreve,
          onclick: () => x.executar?.(a, { recarregar: carregar }) })),
        noMenu.length ? botaoMenu(botao('Mais', { icone: 'reticencias-v', rotuloAria: 'Mais ações' }),
          () => noMenu.flatMap((x, i) => [x.perigo && i && !noMenu[i - 1].perigo ? '-' : null, {
            rotulo: x.rotulo, icone: x.icone, perigo: x.perigo, desabilitado: x.emBreve, atalho: x.emBreve ? 'em breve' : null,
            onclick: () => x.executar?.(a, { recarregar: carregar }),
          }]).filter(Boolean), { alinhar: 'fim', rotulo: 'Mais ações' }) : null));
  }

  function desenharAbas() {
    const lista = abasVisiveis();
    if (!abaAtual || !lista.some((x) => x.id === abaAtual)) abaAtual = lista[0]?.id;
    preencher(barraAbas, abas(lista.map((x) => ({ id: x.id, rotulo: x.rotulo, icone: x.icone, contagem: x.contagem?.(agente) || null })), abaAtual, (novo) => {
      abaAtual = novo;
      history.replaceState(null, '', `#/dispositivos/${id}${novo === lista[0]?.id ? '' : `?aba=${novo}`}`);
      desenharAba();
    }, 'Seções do dispositivo'));
    painelAba.setAttribute('aria-labelledby', `aba-${abaAtual}`);
  }

  function desenharAba() {
    try { limpezaAba?.(); } catch (e) { console.error(e); }
    limpezaAba = null;
    limpar(painelAba);
    painelAba.setAttribute('aria-labelledby', `aba-${abaAtual}`);
    const aba = abasVisiveis().find((x) => x.id === abaAtual);
    if (!aba) return;
    try { limpezaAba = aba.render(painelAba, { agente, recarregar: carregar }) || null; } catch (e) {
      console.error(e);
      painelAba.append(vazio({ titulo: 'Esta seção falhou', texto: e.message, ilustracao: 'erro', compacto: true }));
    }
  }

  async function carregar(redesenharAba = true) {
    try {
      agente = await get(`/api/agentes/${id}`);
      desenharCabecalho();
      if (redesenharAba) { desenharAbas(); desenharAba(); }
    } catch (e) {
      preencher(cabecalho, vazio({ titulo: 'Dispositivo não encontrado', texto: e.message, ilustracao: 'busca', acoes: [botao('Voltar para a lista', { href: '#/dispositivos' })] }));
      limpar(barraAbas);
    }
  }
  carregar();

  const cancelar = [
    aoEvento('checkin', (d) => { if (d.id === id && agente) { Object.assign(agente, d); desenharCabecalho(); } }),
    aoEvento('agente', (d) => { if (d.id === id) carregar(false); }),
    aoEvento('agente.canal', (d) => { if (d.id === id && agente) { agente.tempo_real = d.conectado; desenharCabecalho(); } }),
    aoEvento('alerta', (d) => { if (d.agente_id === id) carregar(false); }),
  ];
  return () => { cancelar.forEach((c) => c()); limpezaAba?.(); };
}
