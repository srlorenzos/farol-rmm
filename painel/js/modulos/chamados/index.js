// Módulo Chamados: helpdesk aberto pela bandeja do agente (agente/farol/bandeja). Lista com filtros e
// ações em massa, tela de conversa em linha do tempo, aba no detalhe do dispositivo, widget de abertos
// na Visão Geral e a seção "Bandeja do agente" em Configurações (marca, contato, recursos ligados/desligados).
// Backend: servidor/src/modulos/chamados/index.js — só usa os campos que ele realmente expõe.
import { h, preencher } from '../../nucleo/dom.js';
import { get, qs } from '../../nucleo/api.js';
import { estado, emitir, aoEvento, paramsEscopo } from '../../nucleo/estado.js';
import { fmtInt } from '../../nucleo/formato.js';
import { icone } from '../../nucleo/icones.js';
import { selo, skeleton } from '../../ui/componentes.js';
import { composicao } from '../../ui/graficos.js';
import { paginaChamados, abaChamadosDispositivo } from './lista.js';
import { paginaChamado } from './detalhe.js';
import { secaoBandeja } from './configuracao.js';

export const STATUS = ['aberto', 'em_andamento', 'aguardando_usuario', 'resolvido', 'fechado'];
export const PRIORIDADES = ['baixa', 'normal', 'alta', 'urgente'];
export const CATEGORIAS = ['acesso', 'desempenho', 'rede', 'impressora', 'software', 'hardware', 'email', 'outro'];

export const NOMES_STATUS = { aberto: 'Aberto', em_andamento: 'Em andamento', aguardando_usuario: 'Aguardando você', resolvido: 'Resolvido', fechado: 'Fechado' };
export const TOM_STATUS = { aberto: 'info', em_andamento: 'info', aguardando_usuario: 'aviso', resolvido: 'ok', fechado: 'neutro' };
export const NOMES_PRIORIDADE = { baixa: 'Baixa', normal: 'Normal', alta: 'Alta', urgente: 'Urgente' };
export const TOM_PRIORIDADE = { baixa: 'neutro', normal: 'neutro', alta: 'aviso', urgente: 'critico' };
export const NOMES_CATEGORIA = { acesso: 'Acesso', desempenho: 'Desempenho', rede: 'Rede', impressora: 'Impressora', software: 'Software', hardware: 'Hardware', email: 'E-mail', outro: 'Outro' };

export const seloStatus = (s) => selo(NOMES_STATUS[s] ?? s, TOM_STATUS[s] ?? 'neutro', s === 'aguardando_usuario' ? { icone: 'aviso' } : {});
export const seloPrioridade = (p) => selo(NOMES_PRIORIDADE[p] ?? p, TOM_PRIORIDADE[p] ?? 'neutro', p === 'urgente' ? { icone: 'critico' } : {});

/** Busca o resumo e atualiza o contador do menu/sino só quando muda (evita redesenhar à toa). */
export async function atualizarContadorChamados() {
  try {
    const r = await get(`/api/chamados/resumo${qs(paramsEscopo())}`);
    if (estado.chamadosAbertos !== r.abertos) { estado.chamadosAbertos = r.abertos; emitir('contadores'); }
    return r;
  } catch { return null; }
}

function widgetChamados(el) {
  const corpo = h('div', { class: 'cartao-corpo' }, skeleton(4));
  el.append(h('header', { class: 'cartao-cabecalho' }, h('h2', { text: 'Chamados de suporte' }),
    h('a', { class: 'widget-acao', href: '#/chamados' }, 'Ver chamados', icone('chevron', { tamanho: 12 }))), corpo);
  const desenhar = async () => {
    const r = await atualizarContadorChamados();
    if (!r) return;
    const s = r.porStatus;
    preencher(corpo,
      h('div', { class: 'linha-entre mb-4' },
        h('div', { class: 'numero-heroi' }, fmtInt(r.abertos), h('small', { text: 'abertos' })),
        r.urgentes ? selo(`${fmtInt(r.urgentes)} urgente${r.urgentes > 1 ? 's' : ''}`, 'critico', { icone: 'critico' }) : h('span', { class: 'sutil pequeno', text: 'Nenhum urgente' })),
      r.abertos ? composicao([
        { rotulo: 'Aberto', valor: s.aberto, cor: 'info', href: '#/chamados?status=aberto' },
        { rotulo: 'Em andamento', valor: s.em_andamento, cor: 'info', href: '#/chamados?status=em_andamento' },
        { rotulo: 'Aguardando você', valor: s.aguardando_usuario, cor: 'aviso', href: '#/chamados?status=aguardando_usuario' },
      ], { rotulo: 'Chamados abertos por status' }) : h('p', { class: 'muted pequeno', text: 'Nenhum chamado aberto no escopo. Tudo tranquilo.' }));
  };
  desenhar();
  return aoEvento('chamado', () => desenhar());
}

export default {
  nome: 'chamados',
  iniciar(farol) {
    farol.menu({ id: 'chamados', rotulo: 'Chamados', icone: 'tag', secao: 'Gerenciar', ordem: 40, href: '#/chamados', permissao: 'chamados.ver', contador: () => estado.chamadosAbertos });
    farol.rota('/chamados', { titulo: 'Chamados', permissao: 'chamados.ver', render: paginaChamados });
    farol.rota('/chamados/:id', { titulo: 'Chamado', permissao: 'chamados.ver', menu: 'chamados', render: paginaChamado });
    farol.abaDispositivo({ id: 'chamados', rotulo: 'Chamados', icone: 'tag', ordem: 70, permissao: 'chamados.ver', render: abaChamadosDispositivo });
    farol.widget({ id: 'chamados', titulo: 'Chamados de suporte', ordem: 25, tamanho: 4, permissao: 'chamados.ver', render: widgetChamados });
    farol.secaoConfig({ id: 'bandeja', rotulo: 'Bandeja do agente', descricao: 'Marca, contato do suporte e recursos da bandeja mostrada ao usuário final', icone: 'tag', ordem: 50, permissao: 'chamados.ver', render: secaoBandeja });
    farol.notificacoes({
      id: 'chamados', permissao: 'chamados.ver', eventos: ['chamado'], href: '#/chamados?status=aguardando_usuario',
      contar: async () => (await atualizarContadorChamados())?.abertos ?? 0,
      listar: async () => (await get(`/api/chamados${qs({ status: 'abertos', limite: 8, ...paramsEscopo() })}`)).map((c) => ({
        titulo: `${c.hostname} · ${c.assunto}`, texto: NOMES_STATUS[c.status], quando: c.atualizado_em, href: `#/chamados/${c.id}`,
        icone: c.prioridade === 'urgente' ? 'critico' : 'tag', tom: c.prioridade === 'urgente' ? 'critico' : TOM_STATUS[c.status],
      })),
    });
    farol.comando({ id: 'chamados-abrir', rotulo: 'Ver chamados de suporte', icone: 'tag', palavras: 'ticket helpdesk suporte bandeja', permissao: 'chamados.ver', executar: () => { location.hash = '#/chamados'; } });
    aoEvento('escopo', atualizarContadorChamados);
  },
};
