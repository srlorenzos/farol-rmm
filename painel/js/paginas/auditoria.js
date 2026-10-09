// Log de auditoria com filtros por ação, usuário e texto.
import { h, icone, preencher, fmtData, debounce } from '../util.js';
import { get } from '../api.js';
import { cabecalhoPagina, skeleton, vazio, toastErro } from '../ui.js';

const ROTULOS = {
  login: 'Login', login_falha: 'Falha de login', login_bloqueado: 'Login bloqueado', logout: 'Logout',
  admin_criado: 'Admin criado', senha_alterada: 'Senha alterada', '2fa_ativado': '2FA ativado',
  modo_elevado: 'Confirmação 2FA', elevacao_falha: 'Falha na confirmação 2FA',
  token_criado: 'Token criado', token_revogado: 'Token revogado',
  agente_registrado: 'Agente registrado', agente_registro_negado: 'Registro negado', agente_revogado: 'Agente revogado',
  script_criado: 'Script criado', script_alterado: 'Script alterado', script_excluido: 'Script excluído',
  script_executado: 'Script executado', comando_executado: 'Comando executado',
  regras_alteradas: 'Regras alteradas', webhook_testado: 'Webhook testado', alerta_resolvido: 'Alerta resolvido',
};
const SENSIVEIS = new Set(['login_falha', 'login_bloqueado', 'agente_registro_negado', 'elevacao_falha', 'agente_revogado', 'script_executado', 'comando_executado']);

export function render(raiz) {
  const acao = h('select', { class: 'input select', 'aria-label': 'Ação' }, h('option', { value: '' }, 'Todas as ações'));
  const usuario = h('select', { class: 'input select', 'aria-label': 'Usuário' }, h('option', { value: '' }, 'Todos os usuários'));
  const busca = h('input', { class: 'input', type: 'search', placeholder: 'Alvo, detalhe ou IP…', 'aria-label': 'Buscar na auditoria' });
  const tabela = h('div', { class: 'tabela-rolagem' }, skeleton(8));
  const total = h('span', { class: 'muted' });
  raiz.append(cabecalhoPagina('Auditoria', 'Quem fez o quê, quando e de onde'),
    h('div', { class: 'filtros' }, acao, usuario, h('label', { class: 'busca' }, icone('busca', { tamanho: 16 }), busca), total),
    tabela);

  let opcoesCarregadas = false;
  async function carregar() {
    const q = new URLSearchParams();
    if (acao.value) q.set('acao', acao.value);
    if (usuario.value) q.set('usuario', usuario.value);
    if (busca.value.trim()) q.set('q', busca.value.trim());
    try {
      const r = await get(`/api/auditoria?${q}`);
      if (!opcoesCarregadas) {
        opcoesCarregadas = true;
        acao.append(...r.acoes.map((a) => h('option', { value: a }, ROTULOS[a] ?? a)));
        usuario.append(...r.usuarios.map((u) => h('option', { value: u }, u)));
      }
      total.textContent = `${r.linhas.length} evento(s)${r.linhas.length === 200 ? ' (mais recentes)' : ''}`;
      preencher(tabela, r.linhas.length ? h('table', { class: 'tabela' },
        h('thead', {}, h('tr', {}, ['Quando', 'Usuário', 'Ação', 'Alvo', 'Detalhes', 'IP'].map((t) => h('th', { scope: 'col' }, t)))),
        h('tbody', {}, r.linhas.map((l) => h('tr', {},
          h('td', { class: 'nowrap', text: fmtData(l.ts) }),
          h('td', { text: l.usuario || '—' }),
          h('td', {}, h('span', { class: ['selo', SENSIVEIS.has(l.acao) && 'selo-alerta'], text: ROTULOS[l.acao] ?? l.acao })),
          h('td', { class: 'quebra', text: l.alvo || '—' }),
          h('td', { class: 'quebra mono pequeno', text: resumo(l.detalhes) }),
          h('td', { class: 'mono', text: l.ip || '—' })))))
        : vazio('Nenhum evento encontrado'));
    } catch (e) { toastErro(e); }
  }
  acao.addEventListener('change', carregar);
  usuario.addEventListener('change', carregar);
  busca.addEventListener('input', debounce(carregar, 300));
  carregar();
}

function resumo(detalhes) {
  if (!detalhes) return '—';
  try {
    const d = JSON.parse(detalhes);
    if (typeof d !== 'object' || d === null) return String(d);
    if (d.nome) return [d.nome, d.shell, d.comando].filter(Boolean).join(' · ');
    if (d.depois) return 'Regras de alerta atualizadas';
    return JSON.stringify(d).slice(0, 200);
  } catch {
    return detalhes.slice(0, 200);
  }
}
