// Tela de um chamado: conversa em linha do tempo (com prints ampliáveis), painel lateral com dados do
// dispositivo e controles de status/prioridade/responsável, campo de resposta.
import { h, preencher } from '../../nucleo/dom.js';
import { get, put, post } from '../../nucleo/api.js';
import { estado, aoEvento, pode } from '../../nucleo/estado.js';
import { relativo, fmtData, fmtBytes } from '../../nucleo/formato.js';
import { icone, iconeSo } from '../../nucleo/icones.js';
import { cabecalhoPagina, select, textarea, botao, selo, vazio, skeleton, fatos, aviso, comCarregando, check } from '../../ui/componentes.js';
import { modal, toast, toastErro } from '../../ui/camadas.js';
import { STATUS, PRIORIDADES, NOMES_STATUS, NOMES_PRIORIDADE, NOMES_CATEGORIA, seloStatus, seloPrioridade } from './index.js';

function abrirImagemGrande(url, legenda) {
  modal({ titulo: legenda || 'Print', largura: 'lg', conteudo: () => h('img', { src: url, alt: legenda || 'Print anexado', estilo: { width: '100%', borderRadius: 'var(--raio-2)', display: 'block' } }) });
}

function bolhaMensagem(m, { chamadoId, anexos }) {
  const minha = m.autor_tipo === 'tecnico';
  const meusAnexos = anexos.filter((a) => a.mensagem_id === m.id);
  return h('div', { estilo: { display: 'flex', justifyContent: minha ? 'flex-end' : 'flex-start' } },
    h('div', { estilo: { maxWidth: '82%', padding: '10px 14px', borderRadius: 'var(--raio-3)', background: minha ? 'var(--marca-lavagem)' : 'var(--superficie-2)', border: '1px solid var(--borda)' } },
      h('div', { class: 'linha gap-2 mb-1', estilo: { justifyContent: 'space-between' } },
        h('span', { class: 'forte pequeno', text: m.autor || (minha ? 'Técnico' : 'Usuário') }),
        h('span', { class: 'sutil pequeno', title: fmtData(m.criado_em), text: relativo(m.criado_em) })),
      h('p', { class: 'pequeno', estilo: { whiteSpace: 'pre-wrap', margin: 0, wordBreak: 'break-word' }, text: m.texto }),
      meusAnexos.length ? h('div', { class: 'linha gap-2 mt-2', estilo: { flexWrap: 'wrap' } }, meusAnexos.map((a) => {
        const url = `/api/chamados/${chamadoId}/anexos/${a.id}`;
        return h('img', {
          src: url, alt: a.nome_arquivo, title: `${a.nome_arquivo} · ${fmtBytes(a.tamanho)}`,
          estilo: { maxWidth: '240px', maxHeight: '180px', borderRadius: 'var(--raio-2)', cursor: 'zoom-in', display: 'block', border: '1px solid var(--borda-forte)' },
          onclick: () => abrirImagemGrande(url, a.nome_arquivo),
        });
      })) : null));
}

function painelConversa(c, recarregar) {
  const corpo = h('div', { class: 'pilha-2' }, c.mensagens.length
    ? c.mensagens.map((m) => bolhaMensagem(m, { chamadoId: c.id, anexos: c.anexos }))
    : h('p', { class: 'sutil pequeno', text: 'Nenhuma mensagem ainda.' }));

  const podeResponder = pode('chamados.responder') && c.status !== 'fechado';
  const texto = textarea({ placeholder: 'Escreva uma resposta…', linhas: 3 });
  const marcarResolvido = check('Marcar como resolvido ao enviar');
  const enviar = botao('Enviar resposta', { icone: 'check', variante: 'primario', desabilitado: !podeResponder });
  enviar.addEventListener('click', () => comCarregando(enviar, async () => {
    const t = texto.value.trim();
    if (!t) return;
    try {
      await post(`/api/chamados/${c.id}/mensagens`, { texto: t, ...(marcarResolvido.input.checked ? { status: 'resolvido' } : {}) });
      texto.value = ''; marcarResolvido.input.checked = false;
      toast('Resposta enviada.', 'sucesso');
      recarregar();
    } catch (e) { toastErro(e); }
  }));

  return h('section', { class: 'cartao' }, h('div', { class: 'cartao-corpo' },
    h('div', { class: 'pilha-2', estilo: { maxHeight: '520px', overflowY: 'auto', paddingRight: '4px' } }, corpo),
    c.status === 'fechado' ? aviso('Este chamado está fechado. Reabra mudando o status ao lado para responder.', 'info')
      : podeResponder ? h('div', { class: 'pilha-2 mt-4' }, texto, h('div', { class: 'linha-entre' }, marcarResolvido.el, enviar)) : null));
}

function painelLateral(c, recarregar) {
  const podeEditar = pode('chamados.responder');
  const selStatus = select(STATUS.map((s) => [s, NOMES_STATUS[s]]), c.status, { rotulo: 'Status' });
  const selPrioridade = select(PRIORIDADES.map((p) => [p, NOMES_PRIORIDADE[p]]), c.prioridade, { rotulo: 'Prioridade' });
  selStatus.disabled = selPrioridade.disabled = !podeEditar;
  const salvarCampo = async (corpo) => { try { await put(`/api/chamados/${c.id}`, corpo); toast('Atualizado.', 'sucesso'); recarregar(); } catch (e) { toastErro(e); } };
  selStatus.addEventListener('change', () => salvarCampo({ status: selStatus.value }));
  selPrioridade.addEventListener('change', () => salvarCampo({ prioridade: selPrioridade.value }));

  const botaoAtribuirMim = botao('Atribuir a mim', { tamanho: 'pequeno', icone: 'usuario', desabilitado: !podeEditar || c.tecnico === estado.usuario,
    onclick: () => salvarCampo({ tecnico: estado.usuario }) });

  const sistema = c.dados_sistema || {};
  const fatosSistema = [
    ['Usuário', c.usuario_windows], ['Sistema', (sistema.so_versao || sistema.so || null)?.replace(/\s*\(build \d+\)/, '')],
    ['IP', sistema.ip], ['CPU', sistema.cpu_pct != null ? `${Math.round(sistema.cpu_pct)}%` : null],
    ['Memória', sistema.ram_total ? `${fmtBytes(sistema.ram_usada)} de ${fmtBytes(sistema.ram_total)}` : null],
  ].filter(([, v]) => v != null);

  return h('div', { class: 'pilha' },
    h('section', { class: 'cartao' }, h('div', { class: 'cartao-corpo pilha-2' },
      h('h3', { class: 'sr', text: 'Dispositivo' }),
      h('a', { class: 'linha gap-2 forte', href: `#/dispositivos/${c.agente_id}` }, iconeSo(sistema.so), c.hostname),
      h('span', { class: 'sutil pequeno', text: c.site_nome }),
      h('div', { class: 'campo' }, h('span', { class: 'rotulo', text: 'Status' }), selStatus),
      h('div', { class: 'campo' }, h('span', { class: 'rotulo', text: 'Prioridade' }), selPrioridade),
      h('div', { class: 'campo' }, h('span', { class: 'rotulo', text: 'Responsável' }),
        h('div', { class: 'linha-entre' }, h('span', { text: c.tecnico || 'Ninguém ainda' }), botaoAtribuirMim)))),
    fatosSistema.length ? h('section', { class: 'cartao' }, h('div', { class: 'cartao-corpo' },
      h('h3', { class: 'pequeno forte mb-2', text: 'Sistema no momento da abertura' }), fatos(fatosSistema))) : null);
}

function montarDetalhe(c, recarregar) {
  return [
    h('section', { class: 'cartao' }, h('div', { class: 'cartao-corpo' },
      h('div', { class: 'linha-entre' },
        h('div', {}, h('h2', { text: c.assunto }),
          h('div', { class: 'linha gap-2 mt-1' }, seloStatus(c.status), seloPrioridade(c.prioridade), selo(NOMES_CATEGORIA[c.categoria] ?? c.categoria, 'neutro'))),
        h('span', { class: 'sutil pequeno', title: fmtData(c.criado_em), text: `Aberto ${relativo(c.criado_em)}` })))),
    h('div', { class: 'dividido mt-4' }, painelLateral(c, recarregar), painelConversa(c, recarregar)),
  ];
}

export function paginaChamado(raiz, { params }) {
  const corpo = h('div', {}, skeleton(8));
  raiz.append(cabecalhoPagina({ titulo: `Chamado #${params.id}`, migalhas: [['Gerenciar'], ['Chamados', '#/chamados'], [`#${params.id}`]] }), corpo);
  async function carregar() {
    try {
      const c = await get(`/api/chamados/${params.id}`);
      preencher(corpo, montarDetalhe(c, carregar));
    } catch (e) {
      preencher(corpo, vazio({ titulo: 'Chamado não encontrado', texto: 'Ele pode ter sido removido ou o link está errado.', ilustracao: 'busca' }));
      toastErro(e);
    }
  }
  carregar();
  return aoEvento('chamado', (ev) => { if (String(ev.id) === String(params.id)) carregar(); });
}
