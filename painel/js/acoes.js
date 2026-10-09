// Fluxos compartilhados entre páginas: executar script, adicionar agente.
import { h, icone, preencher, NOMES_SHELL, fmtData, relativo } from './util.js';
import { get, post } from './api.js';
import { modal, toast, toastErro, garantirElevado, botaoCopiar, bloco, statusAgente, skeleton } from './ui.js';

/** Envia a execução para o servidor, pedindo o código TOTP se preciso. */
export async function enviarExecucao(corpo, descricao) {
  if (!(await garantirElevado(descricao))) return null;
  try {
    const r = await post('/api/executar', corpo);
    toast(`${r.jobs.length} execução(ões) na fila. O resultado aparece em instantes.`, 'sucesso');
    return r;
  } catch (e) {
    if (e.dados?.precisaElevar) {
      // A elevação expirou entre a checagem e o envio: tenta mais uma vez.
      if (await garantirElevado(descricao)) return enviarExecucao(corpo, descricao);
      return null;
    }
    toastErro(e);
    return null;
  }
}

/** Modal: escolher um script para rodar nos agentes selecionados. */
export async function escolherScriptEExecutar(agentes) {
  const lista = h('div', { class: 'lista-escolha' }, skeleton(4));
  const busca = h('input', { class: 'input', type: 'search', placeholder: 'Buscar script…', 'aria-label': 'Buscar script' });
  let scripts = [];
  const m = modal({
    titulo: `Executar em ${agentes.length} agente(s)`, largura: 'md',
    conteudo: (fechar) => {
      const desenhar = () => {
        const q = busca.value.trim().toLowerCase();
        const filtrados = scripts.filter((s) => !q || s.nome.toLowerCase().includes(q) || s.descricao.toLowerCase().includes(q));
        preencher(lista, filtrados.length ? filtrados.map((s) => h('button', {
          class: 'item-escolha', type: 'button', onclick: () => fechar(s),
        }, h('span', {}, h('strong', { text: s.nome }), h('span', { class: 'muted', text: s.descricao })),
        h('span', { class: 'selo', text: NOMES_SHELL[s.shell] }))) : h('p', { class: 'muted', text: 'Nenhum script encontrado.' }));
      };
      busca.addEventListener('input', desenhar);
      get('/api/scripts').then((r) => { scripts = r; desenhar(); }).catch(toastErro);
      return [
        h('p', { class: 'muted' }, 'Alvos: ', agentes.map((a) => a.hostname).join(', ')),
        busca, lista,
      ];
    },
  });
  const script = await m.promessa;
  if (!script) return null;
  return enviarExecucao({ agentes: agentes.map((a) => a.id), script_id: script.id },
    `Executar “${script.nome}” em ${agentes.length} agente(s).`);
}

/** Modal: escolher agentes para rodar um script. */
export async function escolherAgentesEExecutar(script) {
  const lista = h('div', { class: 'lista-escolha' }, skeleton(4));
  const selecionados = new Set();
  const contador = h('span', { class: 'muted', text: '0 selecionado(s)' });
  const botao = h('button', { class: 'btn btn-primario', type: 'button', disabled: true }, icone('play', { tamanho: 14 }), 'Continuar');
  let agentes = [];
  const m = modal({
    titulo: `Executar “${script.nome}”`, largura: 'md',
    conteudo: (fechar) => {
      botao.addEventListener('click', () => fechar(agentes.filter((a) => selecionados.has(a.id))));
      const todos = h('input', { type: 'checkbox', id: 'sel-todos-modal' });
      const atualizar = () => {
        contador.textContent = `${selecionados.size} selecionado(s)`;
        botao.disabled = !selecionados.size;
        todos.checked = selecionados.size && selecionados.size === agentes.length;
      };
      todos.addEventListener('change', () => {
        agentes.forEach((a) => (todos.checked ? selecionados.add(a.id) : selecionados.delete(a.id)));
        lista.querySelectorAll('input[type=checkbox]').forEach((c) => { c.checked = todos.checked; });
        atualizar();
      });
      get('/api/agentes').then((r) => {
        agentes = r;
        preencher(lista, r.length ? r.map((a) => {
          const id = `sel-${a.id}`;
          const c = h('input', { type: 'checkbox', id });
          c.addEventListener('change', () => { c.checked ? selecionados.add(a.id) : selecionados.delete(a.id); atualizar(); });
          return h('label', { class: 'item-escolha item-check', for: id }, c,
            h('span', {}, h('strong', { text: a.hostname }), h('span', { class: 'muted', text: a.so_versao || a.so || '' })),
            statusAgente(a.status));
        }) : h('p', { class: 'muted', text: 'Nenhum agente cadastrado.' }));
      }).catch(toastErro);
      return [
        h('p', { class: 'muted' }, `${NOMES_SHELL[script.shell]} · tempo limite ${script.timeout} s. Agentes offline executam ao voltar.`),
        h('label', { class: 'check-todos', for: 'sel-todos-modal' }, todos, 'Selecionar todos'),
        lista,
        h('div', { class: 'modal-acoes' }, contador, h('button', { class: 'btn', type: 'button', onclick: () => fechar(null) }, 'Cancelar'), botao),
      ];
    },
  });
  const escolhidos = await m.promessa;
  if (!escolhidos?.length) return null;
  return enviarExecucao({ agentes: escolhidos.map((a) => a.id), script_id: script.id },
    `Executar “${script.nome}” em ${escolhidos.length} agente(s).`);
}

/** Modal: gerar token de instalação e mostrar os comandos prontos. */
export function adicionarAgente() {
  modal({
    titulo: 'Adicionar agente', largura: 'lg',
    conteudo: () => {
      const corpo = h('div', {});
      const descricao = h('input', { id: 'desc-token', class: 'input', maxlength: 120, placeholder: 'Ex.: Notebook da recepção' });
      const gerar = h('button', { class: 'btn btn-primario', type: 'submit' }, icone('chave', { tamanho: 14 }), 'Gerar token de instalação');
      const form = h('form', {
        class: 'form form-linha', onsubmit: async (ev) => {
          ev.preventDefault();
          gerar.disabled = true;
          try {
            const r = await post('/api/tokens-instalacao', descricao.value.trim() ? { descricao: descricao.value.trim() } : {});
            preencher(corpo, resultadoToken(r));
          } catch (e) { toastErro(e); gerar.disabled = false; }
        },
      }, h('div', { class: 'campo campo-cresce' }, h('label', { for: 'desc-token', class: 'rotulo' }, 'Descrição (opcional)'), descricao), gerar);
      corpo.append(
        h('p', { class: 'muted' }, 'O token vale por 24 horas e só pode ser usado uma vez. Depois do registro, o agente recebe uma credencial própria.'),
        form, tokensRecentes());
      return corpo;
    },
  });
}

function resultadoToken(r) {
  const abas = { windows: 'Windows (PowerShell como administrador)', linux: 'Linux (terminal)' };
  let atual = /win/i.test(navigator.userAgent) ? 'windows' : 'linux';
  const area = h('div', { class: 'aba-conteudo' });
  const botoes = Object.keys(abas).map((k) => {
    const b = h('button', { class: 'aba', role: 'tab', type: 'button', 'aria-selected': String(k === atual), onclick: () => { atual = k; desenhar(); } }, k === 'windows' ? 'Windows' : 'Linux');
    b.dataset.aba = k;
    return b;
  });
  const desenhar = () => {
    botoes.forEach((b) => b.setAttribute('aria-selected', String(b.dataset.aba === atual)));
    preencher(area, 
      h('div', { class: 'linha-entre' }, h('span', { class: 'rotulo', text: abas[atual] }), botaoCopiar(() => r.comandos[atual], 'Copiar comando')),
      bloco(r.comandos[atual], 'bloco-comando'));
  };
  desenhar();
  return h('div', { class: 'token-gerado' },
    h('div', { class: 'aviso-sucesso' }, icone('check'), h('span', {}, 'Token criado. Ele não será mostrado de novo — copie agora. Expira ', relativo(r.expira_em), ` (${fmtData(r.expira_em)}).`)),
    h('div', { class: 'linha-entre' }, h('code', { class: 'token-texto', text: r.token }), botaoCopiar(r.token, 'Copiar token')),
    h('div', { class: 'abas', role: 'tablist', 'aria-label': 'Sistema operacional' }, botoes),
    area,
    h('p', { class: 'ajuda' }, 'Requisitos: Python 3.10+ e o pacote psutil (no Linux: ', h('code', {}, 'sudo apt install python3-psutil'), ' ou pip). Para rodar como serviço, veja o README.'));
}

function tokensRecentes() {
  const caixa = h('details', { class: 'tokens-recentes' }, h('summary', {}, 'Tokens recentes'));
  caixa.addEventListener('toggle', async () => {
    if (!caixa.open || caixa.dataset.carregado) return;
    caixa.dataset.carregado = '1';
    try {
      const lista = await get('/api/tokens-instalacao');
      caixa.append(lista.length ? h('ul', { class: 'lista-simples' }, lista.map((t) => h('li', {},
        h('span', {}, h('strong', { text: t.descricao || `Token #${t.id}` }), ` · por ${t.criado_por} · ${relativo(t.criado_em)}`),
        h('span', { class: 'muted', text: t.usado_em ? `usado por ${t.hostname ?? 'agente'}` : t.expira_em < Date.now() ? 'expirado' : 'disponível' }))))
        : h('p', { class: 'muted', text: 'Nenhum token gerado ainda.' }));
    } catch (e) { toastErro(e); }
  });
  return caixa;
}
