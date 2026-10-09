// Componentes de interface: toasts, modais, confirmação TOTP, status, barras e skeletons.
import { h, icone, preencher, fmtPct } from './util.js';
import { post, ErroApi } from './api.js';
import { estado } from './estado.js';

// ---------- Toasts ----------
export function toast(mensagem, tipo = 'info', duracao = 4500) {
  const area = document.getElementById('toasts');
  const el = h('div', { class: `toast toast-${tipo}`, role: tipo === 'erro' ? 'alert' : 'status' },
    icone(tipo === 'erro' ? 'aviso' : tipo === 'sucesso' ? 'check' : 'info'),
    h('span', { text: mensagem }),
    h('button', { class: 'toast-fechar', 'aria-label': 'Fechar aviso', onclick: () => sair() }, icone('fechar', { tamanho: 14 })));
  area.append(el);
  let saiu = false;
  const sair = () => {
    if (saiu) return;
    saiu = true;
    el.classList.add('saindo');
    setTimeout(() => el.remove(), 220);
  };
  setTimeout(sair, duracao);
}

export function toastErro(e) {
  toast(e instanceof ErroApi ? e.message : `Erro inesperado: ${e.message}`, 'erro');
}

// ---------- Modal ----------
/**
 * Abre um modal acessível (foco preso, Esc fecha). Retorna { fechar, el, promessa }.
 * `conteudo` recebe a função fechar(valor) e devolve nós.
 */
export function modal({ titulo, conteudo, largura = 'md' }) {
  const anterior = document.activeElement;
  let resolver;
  const promessa = new Promise((r) => { resolver = r; });
  const idTitulo = `modal-t-${Math.random().toString(36).slice(2)}`;
  const fundo = h('div', { class: 'modal-fundo' });
  const caixa = h('div', { class: `modal modal-${largura}`, role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': idTitulo });
  const fechar = (valor = null) => {
    document.removeEventListener('keydown', teclas, true);
    fundo.classList.add('saindo');
    setTimeout(() => fundo.remove(), 180);
    anterior?.focus?.();
    resolver(valor);
  };
  const teclas = (ev) => {
    if (ev.key === 'Escape') { ev.preventDefault(); fechar(null); }
    if (ev.key === 'Tab') {
      const focaveis = [...caixa.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')]
        .filter((e) => !e.disabled && e.offsetParent !== null);
      if (!focaveis.length) return;
      const [p, u] = [focaveis[0], focaveis[focaveis.length - 1]];
      if (ev.shiftKey && document.activeElement === p) { ev.preventDefault(); u.focus(); }
      else if (!ev.shiftKey && document.activeElement === u) { ev.preventDefault(); p.focus(); }
    }
  };
  caixa.append(
    h('header', { class: 'modal-cabecalho' },
      h('h2', { id: idTitulo, text: titulo }),
      h('button', { class: 'btn-icone', 'aria-label': 'Fechar', onclick: () => fechar(null) }, icone('fechar'))),
    h('div', { class: 'modal-corpo' }, conteudo(fechar)),
  );
  fundo.append(caixa);
  fundo.addEventListener('mousedown', (ev) => { if (ev.target === fundo) fechar(null); });
  document.addEventListener('keydown', teclas, true);
  document.body.append(fundo);
  requestAnimationFrame(() => {
    (caixa.querySelector('[autofocus]') || caixa.querySelector('input, textarea, select, button.btn-primario') || caixa).focus?.();
  });
  return { fechar, el: caixa, promessa };
}

export function confirmar({ titulo, mensagem, rotulo = 'Confirmar', perigo = false }) {
  return modal({
    titulo, largura: 'sm',
    conteudo: (fechar) => [
      h('p', { text: mensagem }),
      h('div', { class: 'modal-acoes' },
        h('button', { class: 'btn', onclick: () => fechar(false) }, 'Cancelar'),
        h('button', { class: perigo ? 'btn btn-perigo' : 'btn btn-primario', autofocus: true, onclick: () => fechar(true) }, rotulo)),
    ],
  }).promessa;
}

/** Campo de código TOTP de 6 dígitos. */
export function campoCodigo(id = 'codigo-totp') {
  return h('input', {
    id, class: 'input input-codigo', inputmode: 'numeric', autocomplete: 'one-time-code', pattern: '[0-9]{6}',
    maxlength: 6, required: true, placeholder: '000000', 'aria-label': 'Código de 6 dígitos do autenticador',
  });
}

/**
 * Garante o "modo elevado": se a sessão não estiver elevada, pede o código TOTP.
 * Resolve true quando liberado.
 */
export async function garantirElevado(descricaoAcao) {
  if (!estado.totpAtivo) {
    toast('Ative o 2FA em Configurações antes de executar scripts.', 'erro');
    location.hash = '#/config';
    return false;
  }
  if (estado.elevadoAte > Date.now() + 5000) return true;
  const r = await modal({
    titulo: 'Confirme com o 2FA', largura: 'sm',
    conteudo: (fechar) => {
      const input = campoCodigo();
      const erro = h('p', { class: 'erro-campo', role: 'alert' });
      const botao = h('button', { class: 'btn btn-primario', type: 'submit' }, icone('chave'), 'Confirmar');
      const form = h('form', {
        class: 'form', onsubmit: async (ev) => {
          ev.preventDefault();
          botao.disabled = true;
          erro.textContent = '';
          try {
            const resp = await post('/api/elevar', { codigo: input.value.trim() });
            estado.elevadoAte = resp.elevadoAte;
            document.dispatchEvent(new CustomEvent('farol:elevado'));
            fechar(true);
          } catch (e) {
            erro.textContent = e.message;
            input.select();
            botao.disabled = false;
          }
        },
      },
      h('p', { class: 'muted' }, descricaoAcao,
        ' Digite o código do aplicativo autenticador. A confirmação vale por 10 minutos.'),
      h('label', { for: 'codigo-totp', class: 'rotulo' }, 'Código 2FA'), input, erro,
      h('div', { class: 'modal-acoes' },
        h('button', { class: 'btn', type: 'button', onclick: () => fechar(false) }, 'Cancelar'), botao));
      input.addEventListener('input', () => { input.value = input.value.replace(/\D/g, '').slice(0, 6); if (input.value.length === 6) form.requestSubmit(); });
      return form;
    },
  }).promessa;
  return !!r;
}

// ---------- Status e barras ----------
const ROTULOS_STATUS = { online: 'Online', offline: 'Offline', pendente: 'Aguardando', revogado: 'Revogado' };

export function statusAgente(status) {
  return h('span', { class: `status status-${status}` },
    h('span', { class: 'status-ponto', 'aria-hidden': 'true' }), ROTULOS_STATUS[status] ?? status);
}

const ROTULOS_JOB = {
  pendente: 'Na fila', enviado: 'Executando', sucesso: 'Sucesso', falha: 'Falha',
  timeout: 'Tempo esgotado', expirado: 'Sem resposta', cancelado: 'Cancelado',
};
export function statusJob(status) {
  return h('span', { class: `selo selo-job-${status}` }, ROTULOS_JOB[status] ?? status);
}

export function nivel(pct) {
  if (pct == null) return 'vazio';
  if (pct >= 90) return 'critico';
  if (pct >= 75) return 'alerta';
  return 'ok';
}

/** Mini barra de uso com o valor em texto ao lado (cor nunca é o único sinal). */
export function miniBarra(pct, rotulo, { comRotulo = false } = {}) {
  const preench = h('span', { class: `mini-barra-valor nivel-${nivel(pct)}` });
  preench.style.width = `${Math.max(0, Math.min(100, pct ?? 0))}%`;
  return h('span', { class: 'mini', title: `${rotulo}: ${fmtPct(pct)}` },
    comRotulo ? h('span', { class: 'mini-rotulo', text: rotulo }) : null,
    h('span', { class: 'mini-barra', role: 'meter', 'aria-label': rotulo, 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': Math.round(pct ?? 0) }, preench),
    h('span', { class: 'mini-texto' }, fmtPct(pct)));
}

export function barra(pct, rotulo) {
  const preench = h('span', { class: `barra-valor nivel-${nivel(pct)}` });
  preench.style.width = `${Math.max(0, Math.min(100, pct ?? 0))}%`;
  return h('span', { class: 'barra', role: 'meter', 'aria-label': rotulo, 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': Math.round(pct ?? 0) }, preench);
}

export function skeleton(linhas = 4, classe = '') {
  return h('div', { class: `skeleton-grupo ${classe}`, 'aria-busy': 'true', 'aria-label': 'Carregando' },
    Array.from({ length: linhas }, (_, i) => {
      const l = h('div', { class: 'skeleton' });
      l.style.width = `${100 - ((i * 17) % 35)}%`;
      return l;
    }));
}

export function vazio(titulo, texto, acao) {
  return h('div', { class: 'vazio' }, h('p', { class: 'vazio-titulo', text: titulo }), texto ? h('p', { class: 'muted', text: texto }) : null, acao ?? null);
}

export function cabecalhoPagina(titulo, subtitulo, ...acoes) {
  return h('header', { class: 'pagina-cabecalho' },
    h('div', {}, h('h1', { text: titulo }), subtitulo ? h('p', { class: 'muted', text: subtitulo }) : null),
    acoes.length ? h('div', { class: 'pagina-acoes' }, acoes) : null);
}

export function botaoCopiar(texto, rotulo = 'Copiar') {
  const b = h('button', { class: 'btn btn-pequeno', type: 'button', 'aria-label': rotulo }, icone('copiar', { tamanho: 14 }), 'Copiar');
  b.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(typeof texto === 'function' ? texto() : texto);
      preencher(b, icone('check', { tamanho: 14 }), 'Copiado');
      setTimeout(() => preencher(b, icone('copiar', { tamanho: 14 }), 'Copiar'), 1600);
    } catch {
      toast('Não foi possível copiar. Selecione o texto manualmente.', 'erro');
    }
  });
  return b;
}

export function bloco(texto, classe = '') {
  return h('pre', { class: `bloco-mono ${classe}`, tabindex: 0 }, h('code', { text: texto }));
}
