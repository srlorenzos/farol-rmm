// "Meus scripts": lista agrupada por categoria + editor com numeração de linhas, sistemas, tipo e variáveis.
import { h, preencher, limpar, debounce } from '../../nucleo/dom.js';
import { icone } from '../../nucleo/icones.js';
import { get, post, put, del } from '../../nucleo/api.js';
import { pode } from '../../nucleo/estado.js';
import { NOMES_SHELL, relativo, normalizar } from '../../nucleo/formato.js';
import { cabecalhoPagina, botao, busca, campo, input, select, textarea, vazio, skeleton, selo, check, comCarregando } from '../../ui/componentes.js';
import { confirmar, toast, toastErro } from '../../ui/camadas.js';
import { executarScript, selosScript } from './executar.js';

export function paginaMeus(raiz, { params }) {
  let scripts = [];
  let atual = params.id === 'novo' ? 'novo' : params.id ? Number(params.id) : null;
  const lista = h('nav', { class: 'cartao', 'aria-label': 'Scripts', estilo: { overflow: 'hidden' } }, h('div', { class: 'cartao-corpo' }, skeleton(8)));
  const editor = h('section', { class: 'cartao' });
  const campoBusca = busca('Filtrar scripts…');
  campoBusca.input.addEventListener('input', debounce(desenharLista, 100));
  raiz.append(
    cabecalhoPagina({
      titulo: 'Meus scripts', migalhas: [['Automação'], ['Scripts']], subtitulo: 'Scripts da sua equipe. Importe prontos da biblioteca ou escreva os seus.',
      acoes: [botao('Biblioteca', { icone: 'biblioteca', href: '#/biblioteca' }), pode('scripts.editar') ? botao('Novo script', { variante: 'primario', icone: 'mais', href: '#/scripts/novo' }) : null].filter(Boolean),
    }),
    h('div', { class: 'dividido' }, h('div', { class: 'pilha-2' }, campoBusca.el, lista), editor));

  function desenharLista() {
    const t = normalizar(campoBusca.input.value).split(/\s+/).filter(Boolean);
    const f = scripts.filter((s) => t.every((x) => normalizar(`${s.nome} ${s.descricao} ${s.categoria}`).includes(x)));
    const porCategoria = new Map();
    for (const s of f) { if (!porCategoria.has(s.categoria)) porCategoria.set(s.categoria, []); porCategoria.get(s.categoria).push(s); }
    preencher(lista, f.length ? [...porCategoria].map(([cat, itens]) => h('div', {},
      h('div', { class: 'menu-titulo', estilo: { padding: '12px 16px 4px' }, text: `${cat} · ${itens.length}` }),
      h('ul', { class: 'lista-linhas' }, itens.map((s) => h('li', {},
        h('a', { class: 'linha-item', href: `#/scripts/${s.id}`, 'aria-current': s.id === atual ? 'page' : null, estilo: s.id === atual ? { background: 'var(--marca-lavagem)' } : {} },
          h('div', { class: 'linha-texto' }, h('span', { class: 'forte', text: s.nome }), h('small', { text: `${NOMES_SHELL[s.shell]} · ${s.origem?.startsWith('biblioteca:') ? 'da biblioteca' : 'próprio'}` }))))))))
      : vazio({ titulo: scripts.length ? 'Nada encontrado' : 'Nenhum script ainda', ilustracao: scripts.length ? 'busca' : 'caixa', compacto: true,
        acoes: scripts.length ? [] : [botao('Abrir a biblioteca', { href: '#/biblioteca', icone: 'biblioteca' })] }));
  }

  function desenharEditor() {
    limpar(editor);
    if (atual == null) {
      editor.append(vazio({ titulo: 'Selecione um script', texto: 'Escolha na lista para ver, editar ou executar. Ou importe um pronto da biblioteca.', ilustracao: 'farol',
        acoes: [botao('Biblioteca', { icone: 'biblioteca', href: '#/biblioteca' }), pode('scripts.editar') ? botao('Novo script', { variante: 'primario', icone: 'mais', href: '#/scripts/novo' }) : null].filter(Boolean) }));
      return;
    }
    const s = atual === 'novo' ? { nome: '', descricao: '', shell: 'powershell', conteudo: '', timeout: 60, categoria: 'Geral', so: ['windows'], tipo: 'acao', variaveis: [] }
      : scripts.find((x) => x.id === atual);
    if (!s) { editor.append(vazio({ titulo: 'Script não encontrado', ilustracao: 'busca' })); return; }
    const leitura = !pode('scripts.editar');
    const nome = input({ valor: s.nome, attrs: { required: true, maxlength: 120, disabled: leitura } });
    const categoria = input({ valor: s.categoria, attrs: { maxlength: 80, disabled: leitura } });
    const descricao = input({ valor: s.descricao, attrs: { maxlength: 1000, disabled: leitura } });
    const shell = select(Object.entries(NOMES_SHELL), s.shell, { attrs: { disabled: leitura } });
    const tipo = select([['acao', 'Ação'], ['monitor', 'Monitor (FAROL_STATUS)'], ['auditoria', 'Auditoria']], s.tipo, { attrs: { disabled: leitura } });
    const timeout = input({ tipo: 'number', valor: s.timeout, attrs: { min: 5, max: 86400, disabled: leitura } });
    const sos = ['windows', 'linux', 'macos'].map((so) => ({ so, c: check({ windows: 'Windows', linux: 'Linux', macos: 'macOS' }[so], { marcado: s.so.includes(so) }) }));
    sos.forEach((x) => { x.c.input.disabled = leitura; });
    const { el: codigo, textarea: area } = editorCodigo(s.conteudo, leitura);
    const variaveis = textarea({ valor: s.variaveis.length ? JSON.stringify(s.variaveis, null, 2) : '', linhas: 5, classe: 'input-mono',
      placeholder: '[{ "nome": "DIAS", "rotulo": "Dias", "tipo": "numero", "padrao": 7 }]', attrs: { disabled: leitura, spellcheck: 'false' } });
    const salvar = botao('Salvar', { variante: 'primario', icone: 'check', tipo: 'submit' });

    const form = h('form', {
      class: 'form', onsubmit: (ev) => {
        ev.preventDefault();
        let vars = [];
        try { vars = variaveis.value.trim() ? JSON.parse(variaveis.value) : []; } catch { toast('Variáveis: JSON inválido.', 'erro'); variaveis.focus(); return; }
        const corpo = { nome: nome.value.trim(), descricao: descricao.value.trim(), categoria: categoria.value.trim() || 'Geral', shell: shell.value, tipo: tipo.value,
          conteudo: area.value, timeout: Number(timeout.value), so: sos.filter((x) => x.c.input.checked).map((x) => x.so), variaveis: vars };
        if (!corpo.nome || !corpo.conteudo.trim()) { toast('Preencha nome e conteúdo.', 'erro'); return; }
        if (!corpo.so.length) { toast('Marque pelo menos um sistema.', 'erro'); return; }
        comCarregando(salvar, async () => {
          try {
            const r = atual === 'novo' ? await post('/api/scripts', corpo) : await put(`/api/scripts/${atual}`, corpo);
            toast('Script salvo.', 'sucesso');
            await carregar();
            if (atual === 'novo') location.hash = `#/scripts/${r.id}`;
          } catch (e) { toastErro(e); }
        });
      },
    },
    h('div', { class: 'grade-2' }, campo('Nome', nome, { obrigatorio: true }), campo('Categoria', categoria)),
    campo('Descrição', descricao),
    h('div', { class: 'grade-3' }, campo('Interpretador', shell), campo('Tipo', tipo), campo('Tempo limite (s)', timeout)),
    h('fieldset', { class: 'campo' }, h('legend', { class: 'rotulo', text: 'Sistemas compatíveis' }), h('div', { class: 'linha gap-4' }, sos.map((x) => x.c.el))),
    h('div', { class: 'campo' }, h('span', { class: 'rotulo', id: 'rot-codigo', text: 'Conteúdo' }), codigo),
    h('details', { open: s.variaveis.length > 0 || null }, h('summary', { class: 'rotulo', estilo: { cursor: 'pointer' } }, `Variáveis (${s.variaveis.length})`),
      h('p', { class: 'ajuda mt-2', text: 'Lista JSON: nome (MAIÚSCULAS), rotulo, tipo (texto, numero, booleano, selecao, senha), padrao, obrigatorio, opcoes. Chegam como FAROL_<NOME>.' }),
      variaveis),
    leitura ? null : h('div', { class: 'linha-entre' },
      h('div', { class: 'grupo-botoes' }, salvar,
        atual !== 'novo' && pode('scripts.executar') ? botao('Executar…', { icone: 'play', onclick: () => executarScript({ script: s }) }) : null),
      atual !== 'novo' ? botao('Excluir', { variante: 'perigo-sutil', icone: 'lixo', onclick: excluir }) : null));
    area.setAttribute('aria-labelledby', 'rot-codigo');

    async function excluir() {
      if (!(await confirmar({ titulo: 'Excluir script', mensagem: `Excluir “${s.nome}”? O histórico de execuções é mantido.`, rotulo: 'Excluir', perigo: true }))) return;
      try { await del(`/api/scripts/${atual}`); toast('Script excluído.', 'sucesso'); location.hash = '#/scripts'; } catch (e) { toastErro(e); }
    }

    editor.append(
      h('header', { class: 'cartao-cabecalho' },
        h('div', {}, h('h2', { text: atual === 'novo' ? 'Novo script' : s.nome }),
          s.atualizado_em ? h('div', { class: 'sub', text: `Alterado ${relativo(s.atualizado_em)}${s.origem?.startsWith('biblioteca:') ? ' · importado da biblioteca' : ''}` }) : null),
        atual !== 'novo' ? selosScript(s) : null),
      h('div', { class: 'cartao-corpo' }, form));
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

/** Textarea monoespaçada com numeração de linhas sincronizada. Tab insere 2 espaços (Esc, Tab sai). */
export function editorCodigo(valor, somenteLeitura = false) {
  const numeros = h('div', { class: 'editor-numeros', 'aria-hidden': 'true' });
  const area = h('textarea', { class: 'editor-texto', spellcheck: 'false', autocapitalize: 'off', autocomplete: 'off', wrap: 'off', rows: 18, readonly: somenteLeitura || null });
  area.value = valor;
  let ultimas = 0;
  const atualizar = () => {
    const n = area.value.split('\n').length;
    if (n !== ultimas) { ultimas = n; numeros.textContent = Array.from({ length: n }, (_, i) => i + 1).join('\n'); }
    numeros.scrollTop = area.scrollTop;
  };
  area.addEventListener('input', atualizar);
  area.addEventListener('scroll', () => { numeros.scrollTop = area.scrollTop; });
  area.addEventListener('keydown', (ev) => {
    if (ev.key === 'Tab' && !ev.shiftKey && !ev.ctrlKey && !somenteLeitura) {
      if (area.dataset.escape === '1') { area.dataset.escape = ''; return; }
      ev.preventDefault();
      area.setRangeText('  ', area.selectionStart, area.selectionEnd, 'end');
      atualizar();
    } else if (ev.key === 'Escape') area.dataset.escape = '1';
  });
  atualizar();
  return { el: h('div', { class: 'editor' }, numeros, area), textarea: area };
}

export { icone, selo };
