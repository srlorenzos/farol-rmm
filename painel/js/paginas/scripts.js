// Biblioteca de scripts: lista + editor com numeração de linhas.
import { h, icone, limpar, preencher, debounce, NOMES_SHELL, relativo } from '../util.js';
import { get, post, put, del } from '../api.js';
import { cabecalhoPagina, skeleton, vazio, toastErro, toast, confirmar } from '../ui.js';
import { escolherAgentesEExecutar } from '../acoes.js';

export function render(raiz, { params }) {
  let scripts = [];
  let atualId = params.id === 'novo' ? 'novo' : params.id ? Number(params.id) : null;
  const lista = h('nav', { class: 'scripts-lista', 'aria-label': 'Scripts' }, skeleton(6));
  const editor = h('section', { class: 'scripts-editor painel-bloco' });
  const busca = h('input', { class: 'input', type: 'search', placeholder: 'Buscar…', 'aria-label': 'Buscar scripts' });
  raiz.append(
    cabecalhoPagina('Scripts', 'Biblioteca de scripts para executar nos agentes',
      h('a', { class: 'btn btn-primario', href: '#/scripts/novo' }, icone('mais', { tamanho: 16 }), 'Novo script')),
    h('div', { class: 'scripts-layout' },
      h('div', { class: 'scripts-coluna' }, h('label', { class: 'busca' }, icone('busca', { tamanho: 16 }), busca), lista),
      editor));
  busca.addEventListener('input', debounce(desenharLista, 120));

  function desenharLista() {
    const q = busca.value.trim().toLowerCase();
    const f = scripts.filter((s) => !q || s.nome.toLowerCase().includes(q) || s.descricao.toLowerCase().includes(q));
    preencher(lista, f.length ? h('ul', {}, f.map((s) => h('li', {},
      h('a', { class: ['item-script', s.id === atualId && 'ativo'], href: `#/scripts/${s.id}`, 'aria-current': s.id === atualId ? 'page' : null },
        h('span', { class: 'item-script-nome', text: s.nome }),
        h('span', { class: 'selo', text: NOMES_SHELL[s.shell] })))))
      : h('p', { class: 'muted', text: 'Nenhum script.' }));
  }

  function desenharEditor() {
    limpar(editor);
    if (atualId == null) {
      editor.append(vazio('Selecione um script', 'Escolha um script na lista para editar ou executar, ou crie um novo.'));
      return;
    }
    const s = atualId === 'novo'
      ? { nome: '', descricao: '', shell: 'powershell', conteudo: '', timeout: 60 }
      : scripts.find((x) => x.id === atualId);
    if (!s) { editor.append(vazio('Script não encontrado')); return; }

    const nome = h('input', { id: 'sc-nome', class: 'input', required: true, maxlength: 120, value: s.nome });
    const descricao = h('input', { id: 'sc-desc', class: 'input', maxlength: 500, value: s.descricao });
    const shell = h('select', { id: 'sc-shell', class: 'input select' }, Object.entries(NOMES_SHELL).map(([v, t]) => h('option', { value: v }, t)));
    shell.value = s.shell;
    const timeout = h('input', { id: 'sc-timeout', class: 'input', type: 'number', min: 5, max: 3600, required: true, value: s.timeout });
    const { el: codigo, textarea } = editorCodigo(s.conteudo);
    const salvar = h('button', { class: 'btn btn-primario', type: 'submit' }, icone('check', { tamanho: 14 }), 'Salvar');
    const mudou = () => nome.value !== s.nome || descricao.value !== s.descricao || shell.value !== s.shell
      || Number(timeout.value) !== s.timeout || textarea.value !== s.conteudo;

    const form = h('form', {
      class: 'form', onsubmit: async (ev) => {
        ev.preventDefault();
        const corpo = { nome: nome.value.trim(), descricao: descricao.value.trim(), shell: shell.value, conteudo: textarea.value, timeout: Number(timeout.value) };
        if (!corpo.nome || !corpo.conteudo.trim()) { toast('Preencha nome e conteúdo.', 'erro'); return; }
        salvar.disabled = true;
        try {
          const r = atualId === 'novo' ? await post('/api/scripts', corpo) : await put(`/api/scripts/${atualId}`, corpo);
          toast('Script salvo.', 'sucesso');
          await carregar();
          if (atualId === 'novo') location.hash = `#/scripts/${r.id}`;
        } catch (e) { toastErro(e); } finally { salvar.disabled = false; }
      },
    },
    h('div', { class: 'grade-form' },
      campo('sc-nome', 'Nome', nome),
      campo('sc-shell', 'Interpretador', shell),
      campo('sc-desc', 'Descrição', descricao, 'campo-largo'),
      campo('sc-timeout', 'Tempo limite (segundos)', timeout)),
    h('div', { class: 'campo' }, h('span', { class: 'rotulo', id: 'rot-codigo' }, 'Conteúdo'), codigo),
    h('div', { class: 'linha-entre acoes-editor' },
      h('div', { class: 'grupo-botoes' },
        salvar,
        atualId !== 'novo' ? h('button', {
          class: 'btn', type: 'button', onclick: () => {
            if (mudou()) { toast('Salve as alterações antes de executar.', 'erro'); return; }
            escolherAgentesEExecutar(s);
          },
        }, icone('play', { tamanho: 14 }), 'Executar…') : null),
      atualId !== 'novo' ? h('button', { class: 'btn btn-perigo-sutil', type: 'button', onclick: excluir }, icone('lixo', { tamanho: 14 }), 'Excluir') : null));
    textarea.setAttribute('aria-labelledby', 'rot-codigo');

    async function excluir() {
      if (!(await confirmar({ titulo: 'Excluir script', mensagem: `Excluir “${s.nome}”? O histórico de execuções é mantido.`, rotulo: 'Excluir', perigo: true }))) return;
      try {
        await del(`/api/scripts/${atualId}`);
        toast('Script excluído.', 'sucesso');
        location.hash = '#/scripts';
      } catch (e) { toastErro(e); }
    }

    editor.append(
      h('div', { class: 'linha-entre' }, h('h2', { text: atualId === 'novo' ? 'Novo script' : s.nome }),
        s.atualizado_em ? h('span', { class: 'muted pequeno', text: `Alterado ${relativo(s.atualizado_em)}` }) : null),
      form);
  }

  async function carregar() {
    try {
      scripts = await get('/api/scripts');
      desenharLista();
      desenharEditor();
    } catch (e) { toastErro(e); }
  }
  carregar();
}

function campo(id, rotulo, el, classe = '') {
  return h('div', { class: `campo ${classe}` }, h('label', { for: id, class: 'rotulo' }, rotulo), el);
}

/** Textarea monoespaçada com numeração de linhas sincronizada. */
function editorCodigo(valor) {
  const numeros = h('div', { class: 'editor-numeros', 'aria-hidden': 'true' });
  const textarea = h('textarea', { class: 'editor-texto', spellcheck: 'false', autocapitalize: 'off', autocomplete: 'off', wrap: 'off', rows: 16 });
  textarea.value = valor;
  let ultimas = 0;
  const atualizar = () => {
    const n = textarea.value.split('\n').length;
    if (n !== ultimas) {
      ultimas = n;
      numeros.textContent = Array.from({ length: n }, (_, i) => i + 1).join('\n');
    }
    numeros.scrollTop = textarea.scrollTop;
  };
  textarea.addEventListener('input', atualizar);
  textarea.addEventListener('scroll', () => { numeros.scrollTop = textarea.scrollTop; });
  textarea.addEventListener('keydown', (ev) => {
    if (ev.key === 'Tab' && !ev.shiftKey && !ev.ctrlKey) {
      // Tab insere 2 espaços; Esc + Tab sai do campo (acessibilidade).
      if (textarea.dataset.escape === '1') { textarea.dataset.escape = ''; return; }
      ev.preventDefault();
      textarea.setRangeText('  ', textarea.selectionStart, textarea.selectionEnd, 'end');
      atualizar();
    } else if (ev.key === 'Escape') {
      textarea.dataset.escape = '1';
    }
  });
  atualizar();
  return { el: h('div', { class: 'editor' }, numeros, textarea), textarea };
}
