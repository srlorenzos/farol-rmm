// Biblioteca: centenas de scripts prontos (servidor/biblioteca), com categorias, filtros por SO/tipo, busca,
// detalhe numa gaveta (descrição, variáveis, código) e "Importar" / "Executar".
import { h, preencher, debounce } from '../../nucleo/dom.js';
import { icone } from '../../nucleo/icones.js';
import { get, post, qs } from '../../nucleo/api.js';
import { pode } from '../../nucleo/estado.js';
import { fmtInt, NOMES_SHELL } from '../../nucleo/formato.js';
import { cabecalhoPagina, botao, busca, chipsFiltro, vazio, skeleton, selo, blocoMono, listaDef, aviso } from '../../ui/componentes.js';
import { gaveta, toast, toastErro } from '../../ui/camadas.js';
import { executarScript, selosScript } from './executar.js';

const TIPOS = { acao: 'Ação', monitor: 'Monitor', auditoria: 'Auditoria' };

export function paginaBiblioteca(raiz, { query }) {
  const filtro = { q: query.get('q') || '', categoria: query.get('categoria') || '', so: '', tipo: '' };
  const categorias = h('nav', { class: 'cartao', 'aria-label': 'Categorias', estilo: { overflow: 'hidden' } }, h('div', { class: 'cartao-corpo' }, skeleton(10)));
  const resultado = h('div', {}, skeleton(8));
  const total = h('span', { class: 'sutil pequeno' });
  const campoBusca = busca('Buscar: limpeza, impressora, BitLocker, usuário…', { valor: filtro.q, classe: 'cresce' });
  campoBusca.input.addEventListener('input', debounce(() => { filtro.q = campoBusca.input.value.trim(); carregar(); }, 160));
  const chipsSo = chipsFiltro([{ id: 'windows', rotulo: 'Windows', icone: 'windows' }, { id: 'linux', rotulo: 'Linux', icone: 'linux' }, { id: 'macos', rotulo: 'macOS', icone: 'apple' }],
    '', (v) => { filtro.so = v; carregar(); }, { rotulo: 'Sistema' });
  const chipsTipo = chipsFiltro(Object.entries(TIPOS).map(([id, rotulo]) => ({ id, rotulo })), '', (v) => { filtro.tipo = v; carregar(); }, { rotulo: 'Tipo' });
  raiz.append(
    cabecalhoPagina({ titulo: 'Biblioteca de scripts', migalhas: [['Automação'], ['Biblioteca']],
      subtitulo: 'Scripts prontos e revisados. Variáveis viram formulário; os valores chegam ao script como FAROL_<NOME>.',
      acoes: [botao('Meus scripts', { icone: 'scripts', href: '#/scripts' })] }),
    h('div', { class: 'dividido' }, categorias,
      h('section', { class: 'cartao' }, h('div', { class: 'ferramentas' }, campoBusca.el, total), h('div', { class: 'ferramentas' }, chipsSo, chipsTipo), resultado)));

  let cats = null;
  function desenharCategorias(totalGeral) {
    preencher(categorias, h('ul', { class: 'lista-linhas' },
      [{ slug: '', nome: 'Todas as categorias', total: totalGeral }, ...cats].map((c) => h('li', {},
        h('button', { class: 'linha-item', type: 'button', 'aria-current': c.slug === filtro.categoria ? 'true' : null, estilo: { minHeight: '40px', ...(c.slug === filtro.categoria ? { background: 'var(--marca-lavagem)' } : {}) },
          onclick: () => { filtro.categoria = c.slug; desenharCategorias(totalGeral); carregar(); } },
        h('span', { class: 'linha-texto' }, h('span', { class: c.slug === filtro.categoria ? 'forte' : '', text: c.nome })), h('span', { class: 'linha-meta tabular', text: fmtInt(c.total) }))))));
  }

  let controle;
  async function carregar() {
    controle?.abort();
    controle = new AbortController();
    try {
      const r = await get(`/api/biblioteca${qs(filtro)}`, { sinal: controle.signal });
      if (!cats) { cats = r.categorias; desenharCategorias(r.total); }
      total.textContent = `${fmtInt(r.itens.length)} de ${fmtInt(r.total)} scripts`;
      preencher(resultado, r.itens.length ? h('ul', { class: 'lista-linhas' }, r.itens.slice(0, 300).map((s) => h('li', {},
        h('button', { class: 'linha-item', type: 'button', onclick: () => abrirDetalhe(s.id) },
          h('span', { class: 'paleta-icone', estilo: { display: 'grid', placeItems: 'center', width: '32px', height: '32px', borderRadius: '8px', background: 'var(--superficie-2)', color: 'var(--texto-2)' } }, icone(s.tipo === 'monitor' ? 'pulso' : s.tipo === 'auditoria' ? 'lista' : 'codigo', { tamanho: 16 })),
          h('div', { class: 'linha-texto' }, h('span', { class: 'forte', text: s.nome }), h('small', { text: s.descricao })),
          h('span', { class: 'linha-meta' }, selosScript(s))))))
        : vazio({ titulo: 'Nenhum script encontrado', texto: 'Tente outra palavra ou limpe os filtros.', ilustracao: 'busca' }));
    } catch (e) { if (e.name !== 'AbortError') toastErro(e); }
  }
  carregar();
  if (query.get('id')) abrirDetalhe(query.get('id'));
}

export async function abrirDetalhe(id) {
  let s;
  try { s = await get(`/api/biblioteca/${id}`); } catch (e) { toastErro(e); return; }
  gaveta({
    titulo: s.nome, descricao: s.descricao, larga: true,
    conteudo: () => h('div', { class: 'pilha' },
      h('div', {}, selosScript(s), s.tags?.length ? h('div', { class: 'chips mt-2' }, s.tags.map((t) => selo(`#${t}`, 'neutro'))) : null),
      listaDef([['Categoria', s.categoria], ['Interpretador', NOMES_SHELL[s.shell]], ['Tipo', TIPOS[s.tipo]], ['Tempo limite', `${fmtInt(s.tempo_limite)} s`],
        ['Privilégios', s.requer_admin ? 'Administrador (SYSTEM/root)' : 'Usuário do serviço'], ['Arquivo', h('code', { class: 'inline', text: s.arquivo })]]),
      s.tipo === 'monitor' ? aviso('Script de monitoramento: a última linha da saída traz FAROL_STATUS: ok|alerta|critico e uma mensagem.', 'info') : null,
      s.variaveis.length ? h('div', {}, h('h3', { class: 'mb-2', text: `Variáveis (${s.variaveis.length})` }),
        h('div', { class: 'tabela-caixa cartao' }, h('table', { class: 'tabela tabela-compacta' },
          h('thead', {}, h('tr', {}, ['Variável', 'Rótulo', 'Tipo', 'Padrão'].map((t) => h('th', { scope: 'col' }, t)))),
          h('tbody', {}, s.variaveis.map((v) => h('tr', {}, h('td', { class: 'mono pequeno', text: `FAROL_${v.nome}` }), h('td', {}, v.rotulo, v.obrigatorio ? h('span', { class: 'texto-marca', text: ' *' }) : null),
            h('td', { text: v.tipo }), h('td', { class: 'mono pequeno', text: v.padrao ?? '—' }))))))) : null,
      h('div', {}, h('h3', { class: 'mb-2', text: 'Código' }), blocoMono(s.conteudo))),
    rodape: (fechar) => [
      pode('scripts.editar') ? botao(s.importado_id ? 'Já importado — abrir' : 'Importar para meus scripts', { icone: 'importar', onclick: async () => {
        if (s.importado_id) { fechar(); location.hash = `#/scripts/${s.importado_id}`; return; }
        try { const r = await post(`/api/biblioteca/${s.id}/importar`); toast('Script importado para Meus scripts.', 'sucesso'); fechar(); location.hash = `#/scripts/${r.id}`; } catch (e) { toastErro(e); }
      } }) : null,
      pode('scripts.executar') ? botao('Executar…', { variante: 'primario', icone: 'play', onclick: () => { fechar(); executarScript({ biblioteca: s }); } }) : null,
    ].filter(Boolean),
  });
}
