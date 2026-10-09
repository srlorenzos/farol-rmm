// Módulo Auditoria: log completo com filtros e "carregar mais", e a aba Auditoria no detalhe do dispositivo.
import { h, preencher, debounce } from '../../nucleo/dom.js';
import { get, qs } from '../../nucleo/api.js';
import { fmtData, relativo } from '../../nucleo/formato.js';
import { cabecalhoPagina, select, busca, selo, vazio, skeleton, botao, cartao } from '../../ui/componentes.js';
import { tabelaVirtual } from '../../ui/tabela-virtual.js';
import { toastErro } from '../../ui/camadas.js';

export const ROTULOS = {
  login: 'Login', login_falha: 'Falha de login', login_bloqueado: 'Login bloqueado', logout: 'Logout',
  admin_criado: 'Admin criado', senha_alterada: 'Senha alterada', '2fa_ativado': '2FA ativado',
  modo_elevado: 'Confirmação 2FA', elevacao_falha: 'Falha na confirmação 2FA',
  usuario_criado: 'Usuário criado', usuario_alterado: 'Usuário alterado', usuario_excluido: 'Usuário excluído',
  token_criado: 'Token criado', token_revogado: 'Token revogado',
  agente_registrado: 'Dispositivo registrado', agente_registro_negado: 'Registro negado', agente_revogado: 'Dispositivo revogado',
  dispositivo_alterado: 'Dispositivo alterado', dispositivo_movido: 'Dispositivo movido', dispositivos_movidos: 'Dispositivos movidos',
  dispositivo_reiniciar: 'Reinício', dispositivo_desligar: 'Desligamento',
  script_criado: 'Script criado', script_alterado: 'Script alterado', script_excluido: 'Script excluído', script_importado: 'Script importado',
  script_executado: 'Script executado', comando_executado: 'Comando executado', job_cancelado: 'Execução cancelada',
  regras_alteradas: 'Regras alteradas', webhook_testado: 'Webhook testado', alerta_resolvido: 'Alerta resolvido',
  cliente_criado: 'Cliente criado', cliente_alterado: 'Cliente alterado', cliente_excluido: 'Cliente excluído',
  site_criado: 'Site criado', site_alterado: 'Site alterado', site_excluido: 'Site excluído',
  relay_aberto: 'Sessão remota aberta', relay_fechado: 'Sessão remota encerrada', biblioteca_recarregada: 'Biblioteca recarregada',
};
const SENSIVEIS = new Set(['login_falha', 'login_bloqueado', 'agente_registro_negado', 'elevacao_falha', 'agente_revogado', 'script_executado',
  'comando_executado', 'dispositivo_reiniciar', 'dispositivo_desligar', 'relay_aberto', 'usuario_excluido']);

function resumo(detalhes) {
  if (!detalhes) return '—';
  try {
    const d = JSON.parse(detalhes);
    if (typeof d !== 'object' || d === null) return String(d);
    if (d.nome) return [d.nome, d.comando].filter(Boolean).join(' · ');
    if (d.depois) return 'Regras de alerta atualizadas';
    if (d.tipo && d.sessao) return `Sessão ${d.tipo}${d.duracao_ms != null ? ` · ${Math.round(d.duracao_ms / 1000)} s` : ''}`;
    return JSON.stringify(d).slice(0, 200);
  } catch { return detalhes.slice(0, 200); }
}

const colunas = [
  { id: 'quando', rotulo: 'Quando', largura: '150px', render: (l) => h('span', { class: 'muted tabular', title: relativo(l.ts), text: fmtData(l.ts) }), valor: (l) => -l.id },
  { id: 'usuario', rotulo: 'Usuário', largura: '120px', render: (l) => l.usuario || h('span', { class: 'sutil', text: 'sistema' }), valor: (l) => l.usuario },
  { id: 'acao', rotulo: 'Ação', largura: '190px', render: (l) => selo(ROTULOS[l.acao] ?? l.acao, SENSIVEIS.has(l.acao) ? 'aviso' : 'neutro'), valor: (l) => l.acao },
  { id: 'alvo', rotulo: 'Alvo', largura: 'minmax(180px, 1.2fr)', render: (l) => h('span', { title: l.alvo ?? '', text: l.alvo || '—' }), valor: (l) => l.alvo },
  { id: 'det', rotulo: 'Detalhes', largura: 'minmax(220px, 1.6fr)', render: (l) => { const t = resumo(l.detalhes); return h('span', { class: 'mono pequeno muted', title: t, text: t }); } },
  { id: 'ip', rotulo: 'IP', largura: '130px', render: (l) => h('span', { class: 'mono pequeno', text: l.ip || '—' }), valor: (l) => l.ip },
];

function paginaAuditoria(raiz) {
  const acao = select([['', 'Todas as ações']], '', { rotulo: 'Ação' });
  const usuario = select([['', 'Todos os usuários']], '', { rotulo: 'Usuário' });
  const campoBusca = busca('Alvo, detalhe ou IP…', { classe: 'cresce' });
  let linhas = [];
  let mais = false;
  const tabela = tabelaVirtual({ rotulo: 'Auditoria', chave: (l) => l.id, colunas, ordem: { coluna: 'quando', direcao: 'asc' },
    vazio: () => vazio({ titulo: 'Nenhum evento encontrado', ilustracao: 'busca', compacto: true }) });
  const botaoMais = botao('Carregar mais', { icone: 'chevron-baixo', tamanho: 'pequeno', onclick: () => carregar(true) });
  const corpo = h('div', {}, skeleton(8));
  raiz.append(cabecalhoPagina({ titulo: 'Auditoria', migalhas: [['Administração'], ['Auditoria']], subtitulo: 'Quem fez o quê, quando e de onde. Eventos sensíveis em destaque.' }),
    h('section', { class: 'cartao' }, h('div', { class: 'ferramentas' }, campoBusca.el, acao, usuario), corpo, h('div', { class: 'cartao-rodape' }, botaoMais)));
  let opcoes = false;
  async function carregar(continuar = false) {
    try {
      const r = await get(`/api/auditoria${qs({ acao: acao.value, usuario: usuario.value, q: campoBusca.input.value.trim(), limite: 300, antes: continuar ? linhas.at(-1)?.id : null })}`);
      if (!opcoes) {
        opcoes = true;
        acao.append(...r.acoes.map((a) => h('option', { value: a }, ROTULOS[a] ?? a)));
        usuario.append(...r.usuarios.map((u) => h('option', { value: u }, u)));
        preencher(corpo, tabela.el);
      }
      linhas = continuar ? [...linhas, ...r.linhas] : r.linhas;
      mais = r.mais;
      botaoMais.hidden = !mais;
      tabela.definirLinhas(linhas);
    } catch (e) { toastErro(e); }
  }
  acao.addEventListener('change', () => carregar());
  usuario.addEventListener('change', () => carregar());
  campoBusca.input.addEventListener('input', debounce(() => carregar(), 300));
  carregar();
}

function abaAuditoria(el, { agente }) {
  const tabela = tabelaVirtual({ rotulo: 'Auditoria do dispositivo', chave: (l) => l.id, colunas: colunas.filter((c) => c.id !== 'alvo'), ordem: { coluna: 'quando', direcao: 'asc' },
    vazio: () => vazio({ titulo: 'Nenhum evento registrado para este dispositivo', compacto: true, ilustracao: 'caixa' }) });
  el.append(cartao({ semPadding: true, corpo: tabela.el }));
  get(`/api/auditoria?agente=${agente.id}&limite=500`).then((r) => tabela.definirLinhas(r.linhas)).catch(toastErro);
}

export default {
  nome: 'auditoria',
  iniciar(farol) {
    farol.menu({ id: 'auditoria', rotulo: 'Auditoria', icone: 'auditoria', secao: 'Administração', ordem: 20, href: '#/auditoria', permissao: 'auditoria.ver' });
    farol.rota('/auditoria', { titulo: 'Auditoria', permissao: 'auditoria.ver', render: paginaAuditoria });
    farol.abaDispositivo({ id: 'auditoria', rotulo: 'Auditoria', icone: 'auditoria', ordem: 90, permissao: 'auditoria.ver', render: abaAuditoria });
  },
};
