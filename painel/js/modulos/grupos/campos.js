// Campos personalizados (UDFs): definições em Configurações (admin) + edição de valores e tags na aba
// "Campos" do detalhe do dispositivo. Os valores viram dimensão de filtro nos grupos dinâmicos (modal.js).
import { h, preencher } from '../../nucleo/dom.js';
import { get, put, post, del } from '../../nucleo/api.js';
import { pode } from '../../nucleo/estado.js';
import { campo, select, input, check, botao, skeleton, aviso, comCarregando } from '../../ui/componentes.js';
import { confirmar, toast, toastErro } from '../../ui/camadas.js';

const TIPOS = { texto: 'Texto', numero: 'Número', booleano: 'Sim/não', selecao: 'Seleção' };

/** Controle de edição para UM campo personalizado, já com o valor atual. */
function controleValor(def) {
  if (def.tipo === 'booleano') {
    const c = check(def.nome, { marcado: def.valor === 'true' || def.valor === true });
    return { el: c.el, ler: () => (c.input.checked ? 'true' : '') };
  }
  if (def.tipo === 'selecao') {
    const c = select([['', '—'], ...def.opcoes.map((o) => [o, o])], def.valor ?? '');
    return { el: campo(def.nome, c), ler: () => c.value };
  }
  const c = input({ tipo: def.tipo === 'numero' ? 'number' : 'text', valor: def.valor ?? '', classe: def.tipo === 'numero' ? 'input-mono' : null });
  return { el: campo(def.nome, c), ler: () => c.value.trim() };
}

/** Aba "Campos" no detalhe do dispositivo: tags + valores de campos personalizados. */
export function abaCampos(el, { agente }) {
  const corpoTags = h('div', { class: 'cartao-corpo' }, skeleton(2));
  const corpoCampos = h('div', { class: 'cartao-corpo' }, skeleton(3));
  el.append(
    h('section', { class: 'cartao mb-4' }, h('header', { class: 'cartao-cabecalho' }, h('h2', { text: 'Tags' })), corpoTags),
    h('section', { class: 'cartao' }, h('header', { class: 'cartao-cabecalho' }, h('h2', { text: 'Campos personalizados' })), corpoCampos));

  const podeEditar = pode('campos.editar');

  async function carregarTags() {
    try {
      let tags = await get(`/api/agentes/${agente.id}/tags`);
      const desenhar = () => {
        const chips = h('div', { class: 'chips' }, tags.map((t) => h('span', { class: 'chip' }, t,
          podeEditar ? h('button', { type: 'button', 'aria-label': `Remover tag ${t}`, estilo: { marginLeft: '6px', border: 'none', background: 'none', cursor: 'pointer', color: 'inherit' }, onclick: () => salvar(tags.filter((x) => x !== t)) }, '×') : null)));
        const novo = podeEditar ? input({ placeholder: 'Nova tag… (Enter)', classe: 'input-curto', attrs: { maxlength: 60 } }) : null;
        if (novo) novo.addEventListener('keydown', (ev) => {
          if (ev.key !== 'Enter' || !novo.value.trim()) return;
          ev.preventDefault();
          salvar([...tags, novo.value.trim()]);
        });
        preencher(corpoTags, tags.length ? chips : h('p', { class: 'sutil pequeno', text: 'Nenhuma tag.' }), novo ? h('div', { class: 'mt-3' }, novo) : null);
      };
      async function salvar(novasTags) {
        try { tags = await put(`/api/agentes/${agente.id}/tags`, { tags: [...new Set(novasTags)] }); desenhar(); } catch (e) { toastErro(e); }
      }
      desenhar();
    } catch (e) { toastErro(e); }
  }

  async function carregarCampos() {
    try {
      const defs = await get(`/api/agentes/${agente.id}/campos`);
      if (!defs.length) {
        preencher(corpoCampos, pode('campos.gerenciar')
          ? aviso('Nenhum campo personalizado criado ainda.', 'info')
          : h('p', { class: 'sutil pequeno', text: 'Nenhum campo personalizado criado ainda.' }));
        return;
      }
      const controles = defs.map((d) => controleValor(d));
      const salvar = botao('Salvar campos', { variante: 'primario', icone: 'check', desabilitado: !podeEditar });
      if (!podeEditar) controles.forEach((c) => { c.el.querySelectorAll?.('input,select').forEach((x) => { x.disabled = true; }); });
      salvar.addEventListener('click', () => comCarregando(salvar, async () => {
        const valores = Object.fromEntries(defs.map((d, i) => [d.id, controles[i].ler()]));
        try { await put(`/api/agentes/${agente.id}/campos`, { valores }); toast('Campos salvos.', 'sucesso'); } catch (e) { toastErro(e); }
      }));
      preencher(corpoCampos, h('div', { class: 'grade-2' }, controles.map((c) => c.el)), podeEditar ? h('div', { class: 'mt-3' }, salvar) : null);
    } catch (e) { toastErro(e); }
  }

  carregarTags();
  carregarCampos();
}

/** Seção "Campos personalizados" em Configurações: criar/excluir definições (UDFs). */
export function secaoCampos(el) {
  const podeGerenciar = pode('campos.gerenciar');
  const corpo = h('div', {}, skeleton(4));
  el.append(corpo);

  async function carregar() {
    let defs;
    try { defs = await get('/api/campos'); } catch (e) { toastErro(e); return; }

    const lista = defs.length ? h('ul', { class: 'lista-linhas cartao' }, defs.map((d) => h('li', { class: 'linha-entre' },
      h('div', {}, h('span', { class: 'forte pequeno', text: d.nome }), h('div', { class: 'sutil pequeno', text: `${TIPOS[d.tipo]}${d.opcoes.length ? ` · ${d.opcoes.join(', ')}` : ''} · FAROL_${d.chave.replace(/-/g, '_').toUpperCase()}` })),
      podeGerenciar ? botao('Excluir', { tamanho: 'pequeno', variante: 'perigo-sutil', icone: 'lixo', onclick: () => excluirCampo(d) }) : null)))
      : h('p', { class: 'sutil pequeno', text: 'Nenhum campo personalizado criado ainda.' });

    if (!podeGerenciar) { preencher(corpo, lista); return; }

    const nome = input({ placeholder: 'Nome (ex.: Centro de custo)', attrs: { maxlength: 80 } });
    const tipo = select(Object.entries(TIPOS), 'texto');
    const opcoes = input({ placeholder: 'Opções separadas por vírgula (TI, Financeiro, RH...)', attrs: { maxlength: 500 } });
    const areaOpcoes = h('div', { class: 'mt-2', hidden: true }, campo('Opções', opcoes, { ajuda: 'Uma lista de valores possíveis, separados por vírgula.' }));
    tipo.addEventListener('change', () => { areaOpcoes.hidden = tipo.value !== 'selecao'; });
    const criar = botao('Criar campo', { icone: 'mais', variante: 'primario' });
    criar.addEventListener('click', () => comCarregando(criar, async () => {
      if (!nome.value.trim()) { toast('Dê um nome ao campo.', 'erro'); nome.focus(); return; }
      const corpoReq = { nome: nome.value.trim(), tipo: tipo.value };
      if (tipo.value === 'selecao') corpoReq.opcoes = opcoes.value.split(',').map((x) => x.trim()).filter(Boolean);
      try { await post('/api/campos', corpoReq); nome.value = ''; opcoes.value = ''; toast('Campo criado.', 'sucesso'); carregar(); } catch (e) { toastErro(e); }
    }));

    preencher(corpo, lista,
      h('div', { class: 'cartao mt-4', estilo: { padding: '16px' } },
        h('h3', { class: 'mb-3', text: 'Novo campo' }),
        h('div', { class: 'grade-2' }, campo('Nome', nome), campo('Tipo', tipo)),
        areaOpcoes,
        h('div', { class: 'mt-3' }, criar)));
  }

  async function excluirCampo(d) {
    if (!(await confirmar({ titulo: 'Excluir campo', mensagem: `Excluir "${d.nome}"? Os valores salvos nos dispositivos e qualquer grupo que filtre por ele deixam de funcionar.`, rotulo: 'Excluir', perigo: true }))) return;
    try { await del(`/api/campos/${d.id}`); toast('Campo excluído.', 'sucesso'); carregar(); } catch (e) { toastErro(e); }
  }

  carregar();
}
