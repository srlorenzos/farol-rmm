// Lista de grupos dinâmicos: cria/edita (abrirGrupoModal) e exclui. A contagem de cada grupo é recalculada
// pelo servidor a cada carregamento — é sempre o número de dispositivos que batem com o filtro agora.
import { h, preencher } from '../../nucleo/dom.js';
import { get, del } from '../../nucleo/api.js';
import { aoEvento, pode } from '../../nucleo/estado.js';
import { fmtInt } from '../../nucleo/formato.js';
import { cabecalhoPagina, botao, botaoIcone, selo, vazio, skeleton } from '../../ui/componentes.js';
import { tabelaVirtual } from '../../ui/tabela-virtual.js';
import { botaoMenu } from '../../ui/flutuante.js';
import { confirmar, toast, toastErro } from '../../ui/camadas.js';
import { abrirGrupoModal } from './modal.js';

const NOMES_SO = { windows: 'Windows', linux: 'Linux', macos: 'macOS' };

function resumoFiltro(f) {
  const partes = [];
  if (f.so?.length) partes.push(f.so.map((s) => NOMES_SO[s] ?? s).join('/'));
  if (f.site_id) partes.push('1 site');
  if (f.cliente_id) partes.push('1 cliente');
  if (f.nome_contem) partes.push(`nome contém "${f.nome_contem}"`);
  if (f.tag) partes.push(`tag "${f.tag}"`);
  if (f.campo) partes.push('campo personalizado');
  return partes.length ? partes.join(' · ') : 'Todos os dispositivos';
}

export function paginaGrupos(raiz) {
  const tabela = tabelaVirtual({
    rotulo: 'Grupos', chave: (g) => g.id, ordem: { coluna: 'nome', direcao: 'asc' },
    colunas: [
      { id: 'nome', rotulo: 'Nome', largura: 'minmax(160px, 1.5fr)', render: (g) => h('span', { class: 'forte', text: g.nome }), valor: (g) => g.nome },
      { id: 'filtro', rotulo: 'Filtro', largura: 'minmax(220px, 2fr)', render: (g) => h('span', { class: 'sutil pequeno', text: resumoFiltro(g.filtro) }) },
      { id: 'total', rotulo: 'Dispositivos', largura: '140px', render: (g) => selo(fmtInt(g.total), g.total ? 'info' : 'neutro', { icone: 'dispositivos' }), valor: (g) => g.total },
      { id: 'acoes', rotulo: '', largura: '56px', render: (g) => (pode('grupos.gerenciar') ? botaoMenu(botaoIcone('reticencias', 'Ações', { pequeno: true }), () => [
        { rotulo: 'Editar', icone: 'editar', onclick: () => abrirGrupoModal({ grupo: g }) },
        { rotulo: 'Excluir', icone: 'lixo', perigo: true, onclick: () => excluir(g) },
      ], { alinhar: 'fim' }) : null) },
    ],
    aoAbrir: (g) => { if (pode('grupos.gerenciar')) abrirGrupoModal({ grupo: g }); },
    vazio: () => vazio({
      titulo: 'Nenhum grupo dinâmico ainda', ilustracao: 'caixa',
      texto: 'Um grupo é um filtro (sistema, site, tag, campo personalizado...): dispositivos que baterem com ele entram sozinhos, sem precisar editar nada depois.',
      acoes: pode('grupos.gerenciar') ? [botao('Novo grupo', { variante: 'primario', icone: 'mais', onclick: novo })] : [],
    }),
  });

  const corpo = h('div', {}, skeleton(6));
  raiz.append(
    cabecalhoPagina({
      titulo: 'Grupos', migalhas: [['Gerenciar'], ['Grupos']],
      subtitulo: 'Grupos dinâmicos por filtro: sistema operacional, site, nome, tag ou campo personalizado.',
      acoes: pode('grupos.gerenciar') ? [botao('Novo grupo', { variante: 'primario', icone: 'mais', onclick: novo })] : [],
    }),
    h('section', { class: 'cartao' }, corpo));

  function novo() { abrirGrupoModal({}); }

  async function excluir(g) {
    if (!(await confirmar({ titulo: 'Excluir grupo', mensagem: `Excluir "${g.nome}"? Agendamentos, políticas ou execuções que usam este grupo como alvo passam a não encontrar nenhum dispositivo.`, rotulo: 'Excluir', perigo: true }))) return;
    try { await del(`/api/grupos/${g.id}`); toast('Grupo excluído.', 'sucesso'); carregar(); } catch (e) { toastErro(e); }
  }

  let primeira = true;
  async function carregar() {
    try {
      const linhas = await get('/api/grupos');
      if (primeira) { preencher(corpo, tabela.el); primeira = false; }
      tabela.definirLinhas(linhas);
    } catch (e) { toastErro(e); }
  }
  carregar();
  return aoEvento('grupo', () => carregar());
}
