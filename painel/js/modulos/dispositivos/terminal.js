// Terminal interativo remoto: abre uma sessão de relay tipo 'terminal' (servidor/src/modulos/terminal +
// agente/farol/modulos/terminal.py) e mostra um console simples — saída rolável + linha de comando abaixo.
// Sem PTY de verdade do lado do agente (ver o módulo do agente): o painel faz o "eco local" da linha
// digitada e manda ela inteira ao apertar Enter. Funciona bem pra uso normal de console; não dá pra rodar
// programas de tela cheia (vim, htop, less) — documentado na própria UI.
import { h, preencher } from '../../nucleo/dom.js';
import { get } from '../../nucleo/api.js';
import { abrirSessao } from '../../nucleo/estado.js';
import { icone } from '../../nucleo/icones.js';
import { botao, aviso } from '../../ui/componentes.js';
import { gaveta, toast, toastErro } from '../../ui/camadas.js';
import { garantirElevado } from '../../ui/elevar.js';

// Paleta ANSI de 16 cores — fixa (não segue o tema claro/escuro): é conteúdo do terminal remoto, não UI do
// Farol, e precisa do contraste padrão de terminal pra ler direito (fundo sempre escuro, ver CSS abaixo).
const CORES_ANSI = {
  30: '#2b2f33', 31: '#e5534b', 32: '#3fb950', 33: '#d4a72c', 34: '#539bf5', 35: '#c27ae6', 36: '#39c5cf', 37: '#d0d7de',
  90: '#6e7681', 91: '#ff7b72', 92: '#56d364', 93: '#e3b341', 94: '#79c0ff', 95: '#d2a8ff', 96: '#56d4dd', 97: '#f0f6fc',
};
const RE_SGR = /\x1b\[([0-9;]*)m/g;
const RE_OUTRO_ESC = /\x1b\[[0-9;?]*[a-zA-Z]/g;

/** Converte um pedaço de texto com cores ANSI (SGR) em nós <span> estilados; ignora outras sequências de escape. */
function ansiParaNos(texto, estadoEstilo) {
  const nos = [];
  const limpo = texto.replace(RE_OUTRO_ESC, (m) => (m.endsWith('m') ? m : '')); // só remove não-SGR
  let ultimo = 0;
  RE_SGR.lastIndex = 0;
  let m;
  const abrirSpan = (trecho) => {
    if (!trecho) return;
    const estilo = {};
    if (estadoEstilo.cor) estilo.color = estadoEstilo.cor;
    if (estadoEstilo.fundo) estilo.background = estadoEstilo.fundo;
    if (estadoEstilo.negrito) estilo.fontWeight = '700';
    nos.push(h('span', { estilo, text: trecho }));
  };
  while ((m = RE_SGR.exec(limpo))) {
    abrirSpan(limpo.slice(ultimo, m.index));
    ultimo = RE_SGR.lastIndex;
    const codigos = m[1] ? m[1].split(';').map(Number) : [0];
    for (const c of codigos) {
      if (c === 0) { estadoEstilo.cor = null; estadoEstilo.fundo = null; estadoEstilo.negrito = false; }
      else if (c === 1) estadoEstilo.negrito = true;
      else if (c === 22) estadoEstilo.negrito = false;
      else if (c === 39) estadoEstilo.cor = null;
      else if (c === 49) estadoEstilo.fundo = null;
      else if (CORES_ANSI[c]) estadoEstilo.cor = CORES_ANSI[c];
      else if (c >= 40 && c <= 47) estadoEstilo.fundo = CORES_ANSI[c - 10];
      else if (c >= 100 && c <= 107) estadoEstilo.fundo = CORES_ANSI[c - 10];
    }
  }
  abrirSpan(limpo.slice(ultimo));
  return nos;
}

function linhaSaida(texto, estadoEstilo, classe) {
  return h('div', { class: classe }, ...ansiParaNos(texto, estadoEstilo));
}

export function abrirTerminal(agente) {
  const estiloAtual = { cor: null, fundo: null, negrito: false };
  const saida = h('div', {
    class: 'mono pequeno', role: 'log', 'aria-live': 'polite', 'aria-label': 'Saída do terminal',
    estilo: {
      flex: '1', minHeight: '0', overflowY: 'auto', background: '#0b0f12', color: '#d8dee3',
      padding: '12px 14px', borderRadius: 'var(--raio-2)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: '1.5',
    },
  });
  const status = h('span', { class: 'sutil pequeno', text: 'Conectando…' });
  const linha = h('input', {
    class: 'input mono', autocomplete: 'off', spellcheck: 'false', placeholder: 'Digite um comando e aperte Enter…',
    estilo: { background: '#0b0f12', color: '#d8dee3', borderColor: '#2a3138' },
  });
  const btnLimpar = botao('Limpar tela', { tamanho: 'pequeno', icone: 'lixo', onclick: () => preencher(saida, []) });

  let sessao = null;
  let fechada = false;
  const historico = [];
  let indiceHistorico = -1;

  function escrever(texto, classe) { saida.append(linhaSaida(texto, estiloAtual, classe)); saida.scrollTop = saida.scrollHeight; }
  function escreverCru(texto) {
    // saída do processo não vem quebrada por linha — acrescenta como um nó de texto contínuo (preserva \n via pre-wrap).
    const nos = ansiParaNos(texto, estiloAtual);
    saida.append(...nos);
    saida.scrollTop = saida.scrollHeight;
  }

  async function enviarLinha() {
    const texto = linha.value;
    if (!sessao || fechada) return;
    historico.push(texto);
    indiceHistorico = historico.length;
    escrever(`$ ${texto}`, 'forte');
    linha.value = '';
    sessao.enviar(JSON.stringify({ tipo: 'dados', texto: texto + '\r\n' }));
  }

  linha.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') { ev.preventDefault(); enviarLinha(); return; }
    if (ev.key === 'ArrowUp') {
      if (!historico.length) return;
      ev.preventDefault();
      indiceHistorico = Math.max(0, indiceHistorico - 1);
      linha.value = historico[indiceHistorico] ?? '';
      return;
    }
    if (ev.key === 'ArrowDown') {
      if (!historico.length) return;
      ev.preventDefault();
      indiceHistorico = Math.min(historico.length, indiceHistorico + 1);
      linha.value = historico[indiceHistorico] ?? '';
      return;
    }
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'c' && linha.selectionStart === linha.selectionEnd) {
      ev.preventDefault();
      if (sessao && !fechada) {
        escrever('^C', 'sutil');
        sessao.enviar(JSON.stringify({ tipo: 'sinal', nome: 'SIGINT' }));
      }
    }
  });

  const notaGravacao = h('div', {});

  const camada = gaveta({
    titulo: `Terminal — ${agente.hostname}`,
    descricao: 'Sessão interativa auditada; fecha sozinha se ficar ociosa.',
    larga: true,
    conteudo: (fechar) => {
      const corpo = h('div', { estilo: { display: 'flex', flexDirection: 'column', gap: '10px', height: '100%', minHeight: '480px' } },
        aviso('Sem terminal de tela cheia (vim, htop, less não funcionam aqui): roda comando, mostra a saída — como um console normal. A sessão fica auditada.', 'info'),
        notaGravacao,
        saida,
        h('div', { class: 'linha gap-2', estilo: { alignItems: 'center' } }, status, h('span', { class: 'espaco' }), btnLimpar),
        h('div', { class: 'linha gap-2' }, linha,
          botao('Enviar', { icone: 'play', variante: 'primario', tamanho: 'pequeno', onclick: enviarLinha })));
      return corpo;
    },
    rodape: (fechar) => h('div', { class: 'linha-entre' },
      h('span', { class: 'sutil pequeno' }, icone('cadeado', { tamanho: 13 }), ' Exige 2FA · fica na auditoria'),
      h('button', { class: 'btn', type: 'button', onclick: () => fechar(null) }, 'Fechar')),
  });

  avisoGravacao().then((texto) => { if (texto) preencher(notaGravacao, aviso(texto, 'aviso')); }).catch(() => {});

  (async () => {
    if (!(await garantirElevado(`Abrir um terminal em ${agente.hostname}.`))) { camada.fechar(null); return; }
    try {
      sessao = await abrirSessao(agente.id, 'terminal', { cols: 100, linhas: 28 }, {
        aoDados: (d) => escreverCru(d),
        aoFechar: (motivo) => { fechada = true; status.textContent = `Sessão encerrada${motivo ? ` (${motivo})` : ''}.`; linha.disabled = true; },
      });
      status.textContent = 'Conectado.';
      linha.focus();
    } catch (e) {
      fechada = true;
      status.textContent = 'Não foi possível abrir a sessão.';
      linha.disabled = true;
      toastErro(e);
    }
  })();

  const fecharOriginal = camada.fechar.bind(camada);
  camada.fechar = (v) => { try { sessao?.fechar(); } catch { /* já fechada */ } fecharOriginal(v); };
  return camada;
}

/** GET /api/terminal/config — só pra decidir se avisa que a sessão pode estar sendo gravada. */
export async function avisoGravacao() {
  try {
    const cfg = await get('/api/terminal/config');
    return cfg?.gravar_sessoes ? 'As sessões de terminal estão configuradas para serem gravadas (Configurações).' : null;
  } catch { return null; }
}
