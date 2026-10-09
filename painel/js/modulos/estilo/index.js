// Página oculta #/estilo: catálogo vivo de todos os componentes do design system.
// Novos módulos devem usar SOMENTE o que aparece aqui (documentado em painel/DESIGN.md).
import { h } from '../../nucleo/dom.js';
import { icone, NOMES_ICONES, logo, iconeSo } from '../../nucleo/icones.js';
import {
  cabecalhoPagina, botao, botaoIcone, campo, input, select, textarea, busca, check, interruptor, segmentado, campoCodigo,
  selo, estadoDispositivo, severidade, statusJob, medidor, cartao, estatistica, abas, chipsFiltro, skeleton, vazio, aviso,
  listaDef, fatos, blocoMono, botaoCopiar, kbd, sparkline,
} from '../../ui/componentes.js';
import { modal, gaveta, confirmar, toast } from '../../ui/camadas.js';
import { abrirMenu, botaoMenu, menuContexto } from '../../ui/flutuante.js';
import { tabelaVirtual } from '../../ui/tabela-virtual.js';
import { graficoLinha, barras, composicao } from '../../ui/graficos.js';
import { formularioVariaveis } from '../../ui/formulario.js';

const tam = (el, n) => { el.dataset.tamanho = String(n); return el; };
const secao = (id, titulo, ...conteudo) => h('section', { class: 'estilo-secao pilha', id: `estilo-${id}` }, h('h2', { text: titulo }), ...conteudo);
const amostra = (nome) => {
  const cor = h('div', { class: 'amostra-cor' });
  cor.style.background = `var(${nome})`;
  return h('div', { class: 'pilha-2' }, cor, h('code', { class: 'pequeno sutil', text: nome }));
};

function pagina(raiz) {
  const indice = ['Cores', 'Tipografia', 'Botões', 'Formulários', 'Estados', 'Cartões', 'Navegação', 'Feedback', 'Camadas', 'Tabela', 'Gráficos', 'Vazios', 'Ícones'];
  raiz.append(cabecalhoPagina({ titulo: 'Design system do Farol', subtitulo: 'Catálogo vivo dos componentes. Documentação: painel/DESIGN.md.', migalhas: [['Interno'], ['Estilo']] }),
    h('nav', { class: 'chips mb-4', 'aria-label': 'Índice' }, indice.map((t) => h('a', { class: 'chip', href: `#/estilo`, onclick: (ev) => { ev.preventDefault(); document.getElementById(`estilo-${t.toLowerCase()}`)?.scrollIntoView({ behavior: 'smooth' }); } }, t))));

  const cores = ['--marca', '--fundo', '--superficie-0', '--superficie-1', '--superficie-2', '--superficie-3', '--texto-1', '--texto-2', '--texto-3',
    '--ok', '--aviso', '--critico', '--info', '--neutro', '--serie-1', '--serie-2', '--serie-3'];

  const pontos = Array.from({ length: 96 }, (_, i) => ({ t: Date.now() - (96 - i) * 900_000, cpu: 30 + 25 * Math.sin(i / 7) + (i % 5) * 3 }));
  const linhasDemo = Array.from({ length: 2000 }, (_, i) => ({ id: i, nome: `pc-${String(i).padStart(4, '0')}`, uso: (i * 37) % 100, site: ['Matriz', 'Filial Sul', 'Loja Centro'][i % 3] }));
  const tabela = tabelaVirtual({
    rotulo: 'Exemplo', chave: (l) => l.id, selecionavel: true, agrupar: (l) => ({ chave: l.site, rotulo: l.site, icone: 'site' }),
    colunas: [
      { id: 'nome', rotulo: 'Nome', largura: 'minmax(160px, 1fr)', render: (l) => h('span', { class: 'forte', text: l.nome }), valor: (l) => l.nome },
      { id: 'uso', rotulo: 'Uso', largura: '160px', render: (l) => medidor(l.uso, 'Uso'), valor: (l) => l.uso },
      { id: 'site', rotulo: 'Site', largura: '140px', render: (l) => l.site, valor: (l) => l.site },
    ],
    menu: (l) => [{ rotulo: `Abrir ${l.nome}`, icone: 'seta' }, '-', { rotulo: 'Excluir', icone: 'lixo', perigo: true }],
  });
  tabela.definirLinhas(linhasDemo);
  const alvoContexto = h('div', { class: 'cartao centro sutil', estilo: { padding: '24px' }, text: 'Clique com o botão direito aqui (menu de contexto)' });
  menuContexto(alvoContexto, () => [{ rotulo: 'Copiar', icone: 'copiar' }, { rotulo: 'Editar', icone: 'editar' }, '-', { rotulo: 'Excluir', icone: 'lixo', perigo: true }]);
  const formVars = formularioVariaveis([
    { nome: 'DIAS', rotulo: 'Apagar arquivos mais antigos que (dias)', tipo: 'numero', padrao: 7 },
    { nome: 'MODO', rotulo: 'Modo', tipo: 'selecao', opcoes: ['Rápido', 'Completo'], obrigatorio: true },
    { nome: 'FORCAR', rotulo: 'Forçar mesmo com o usuário logado', tipo: 'booleano' },
  ]);

  raiz.append(h('div', { class: 'pilha', estilo: { gap: '40px' } },
    secao('cores', 'Cores (tokens)', h('div', { class: 'grade-4' }, cores.map(amostra)),
      h('p', { class: 'muted pequeno', text: 'Estados (ok/aviso/crítico/info) são reservados e sempre vêm com ícone + rótulo. Séries de dados usam --serie-1..3 (validadas para daltonismo).' })),
    secao('tipografia', 'Tipografia', h('div', { class: 'cartao cartao-corpo pilha-2' },
      h('div', { class: 'numero-heroi' }, '1.284', h('small', { text: 'número herói (40)' })),
      h('h1', { text: 'Título de página (22)' }), h('h2', { text: 'Título de seção (16)' }), h('h3', { text: 'Subtítulo (14)' }),
      h('p', { text: 'Texto do corpo (14) — o Farol usa a fonte do sistema e números tabulares em colunas.' }),
      h('p', { class: 'muted', text: 'Texto secundário (.muted)' }), h('p', { class: 'sutil pequeno', text: 'Metadados (.sutil .pequeno)' }),
      h('p', {}, h('code', { class: 'inline', text: 'código em linha' }), ' ', kbd('Ctrl'), ' ', kbd('K')))),
    secao('botões', 'Botões', h('div', { class: 'cartao cartao-corpo pilha' },
      h('div', { class: 'linha' }, botao('Primário', { variante: 'primario', icone: 'play' }), botao('Secundário', { icone: 'mais' }), botao('Fantasma', { variante: 'fantasma' }),
        botao('Perigo', { variante: 'perigo', icone: 'lixo' }), botao('Perigo sutil', { variante: 'perigo-sutil', icone: 'revogar' }), botao('Em breve', { icone: 'terminal', emBreve: true })),
      h('div', { class: 'linha' }, botao('Pequeno', { tamanho: 'pequeno', icone: 'filtro' }), botao('Grande', { tamanho: 'grande', variante: 'primario' }),
        botaoIcone('config', 'Configurar'), botaoIcone('reticencias', 'Mais', { pequeno: true }), botao('Carregando', { classe: 'carregando' }), botaoCopiar('texto copiado', 'Copiar', { toast })))),
    secao('formulários', 'Formulários', h('div', { class: 'grade-2' },
      h('div', { class: 'cartao cartao-corpo form' }, campo('Campo de texto', input({ placeholder: 'Digite…' }), { ajuda: 'Texto de ajuda', obrigatorio: true }),
        campo('Seleção', select([['a', 'Opção A'], ['b', 'Opção B']])), campo('Área de texto', textarea({ placeholder: 'Várias linhas' })), busca('Busca…').el,
        h('div', { class: 'linha gap-4' }, check('Caixa de seleção', { marcado: true }).el, interruptor('Interruptor', { marcado: true }).el),
        segmentado([['1', '1 h'], ['24', '24 h'], ['168', '7 dias']], '24', () => {}, 'Período'), campo('Código 2FA', campoCodigo())),
      h('div', { class: 'cartao cartao-corpo' }, h('h3', { class: 'mb-3', text: 'Formulário de variáveis de script' }), formVars.el))),
    secao('estados', 'Estados, selos e medidores', h('div', { class: 'cartao cartao-corpo pilha' },
      h('div', { class: 'linha gap-4' }, estadoDispositivo('online'), estadoDispositivo('offline'), estadoDispositivo('pendente'), estadoDispositivo('revogado')),
      h('div', { class: 'linha gap-4' }, severidade('critico'), severidade('alerta'), severidade('info')),
      h('div', { class: 'linha' }, ['pendente', 'enviado', 'sucesso', 'falha', 'timeout', 'expirado', 'cancelado'].map(statusJob)),
      h('div', { class: 'linha' }, selo('Neutro'), selo('Ok', 'ok', { icone: 'check' }), selo('Aviso', 'aviso'), selo('Crítico', 'critico'), selo('Info', 'info'), selo('Marca', 'marca', { icone: 'raio' }), iconeSo('Windows'), iconeSo('Linux'), iconeSo('Darwin')),
      h('div', { class: 'grade-3' }, medidor(42, 'CPU', { rotulo: true }), medidor(81, 'RAM', { rotulo: true }), medidor(96, 'Disco', { rotulo: true })))),
    secao('cartões', 'Cartões e estatísticas', h('div', { class: 'grade-4' },
      estatistica({ rotulo: 'Dispositivos', valor: '1.284', detalhe: '12 novos esta semana', icone: 'dispositivos' }),
      estatistica({ rotulo: 'Online', valor: '1.201', tom: 'ok' }), estatistica({ rotulo: 'Offline', valor: '83', tom: '' }), estatistica({ rotulo: 'Alertas críticos', valor: '7', tom: 'critico', href: '#/alertas' })),
    h('div', { class: 'grade-2' }, cartao({ titulo: 'Cartão com cabeçalho', sub: 'subtítulo', acoes: [botao('Ação', { tamanho: 'pequeno' })], corpo: listaDef([['Fabricante', 'Dell Inc.'], ['Modelo', 'OptiPlex 7090'], ['Série', null]]) }),
      cartao({ titulo: 'Fatos', corpo: fatos([['IP', '10.0.0.12'], ['Usuário', 'maria'], ['Ligado há', '3d 4h'], ['Agente', 'v2.0.0']]) }))),
    secao('navegação', 'Navegação', h('div', { class: 'cartao cartao-corpo pilha' },
      abas([{ id: 'a', rotulo: 'Resumo', icone: 'painel' }, { id: 'b', rotulo: 'Monitoramento', icone: 'pulso' }, { id: 'c', rotulo: 'Software', contagem: 214 }], 'a', () => {}),
      chipsFiltro([{ id: 'on', rotulo: 'Online', n: 1201, ponto: 'ok' }, { id: 'off', rotulo: 'Offline', n: 83 }, { id: 'w', rotulo: 'Windows', icone: 'windows', n: 900 }], 'on', () => {}),
      h('div', { class: 'linha' }, botaoMenu(botao('Menu suspenso', { icone: 'chevron-baixo' }), [{ titulo: 'Seção' }, { rotulo: 'Editar', icone: 'editar', atalho: 'E' }, { rotulo: 'Marcado', marcado: true }, { rotulo: 'Desabilitado', desabilitado: true }, '-', { rotulo: 'Excluir', icone: 'lixo', perigo: true }]),
        h('span', { 'data-dica': 'Dica (tooltip) ao passar o mouse ou focar', tabindex: 0, class: 'selo selo-contorno', text: 'Passe o mouse (dica)' })),
      alvoContexto)),
    secao('feedback', 'Feedback', h('div', { class: 'pilha' },
      aviso('Informação neutra para o usuário.', 'info'), aviso('Operação concluída com sucesso.', 'ok'), aviso('Atenção: isto pede cuidado.', 'alerta'), aviso('Falha crítica.', 'critico'),
      h('div', { class: 'linha' }, ['sucesso', 'erro', 'aviso', 'info'].map((t) => botao(`Toast ${t}`, { tamanho: 'pequeno', onclick: () => toast(`Exemplo de toast de ${t}.`, t, { titulo: t === 'erro' ? 'Algo falhou' : null }) }))),
      h('div', { class: 'cartao cartao-corpo' }, skeleton(4)), blocoMono('$ farol-agente modulos\n  comando ping\n  sessão eco'))),
    secao('camadas', 'Modais, gavetas e confirmação', h('div', { class: 'linha' },
      botao('Abrir modal', { onclick: () => modal({ titulo: 'Título do modal', descricao: 'Descrição curta.', icone: 'info', conteudo: (f) => [h('p', { class: 'muted', text: 'Conteúdo do modal. Esc fecha; o foco fica preso aqui.' }), h('div', { class: 'modal-acoes' }, botao('Cancelar', { onclick: () => f() }), botao('Confirmar', { variante: 'primario', onclick: () => f(true) }))] }) }),
      botao('Abrir gaveta', { onclick: () => gaveta({ titulo: 'Gaveta lateral', descricao: 'Para detalhes e formulários longos.', conteudo: () => listaDef([['Chave', 'Valor'], ['Outra', 'Coisa']]), rodape: (f) => [botao('Fechar', { onclick: () => f() })] }) }),
      botao('Confirmação perigosa', { variante: 'perigo-sutil', onclick: () => confirmar({ titulo: 'Revogar pc-0001?', mensagem: 'Esta ação não pode ser desfeita.', rotulo: 'Revogar', perigo: true, digitar: 'pc-0001' }) }),
      botao('Menu em posição livre', { onclick: (ev) => abrirMenu(ev.currentTarget, [{ rotulo: 'Item 1' }, { rotulo: 'Item 2' }]) }))),
    secao('tabela', 'Tabela virtual (2.000 linhas, agrupada, seleção múltipla)', h('section', { class: 'cartao' }, tabela.el)),
    secao('gráficos', 'Gráficos', h('div', { class: 'grade-widgets' },
      tam(cartao({ corpo: graficoLinha({ titulo: 'CPU', pontos, campo: 'cpu', desde: Date.now() - 24 * 3600_000, ate: Date.now(), baldeMs: 900_000, limite: 90 }) }), 12),
      tam(cartao({ titulo: 'Barras rotuladas', corpo: barras([{ rotulo: 'Windows', valor: 812, icone: icone('windows', { tamanho: 14 }) }, { rotulo: 'Linux', valor: 341, icone: icone('linux', { tamanho: 14 }) }, { rotulo: 'macOS', valor: 48, icone: icone('apple', { tamanho: 14 }) }]) }), 6),
      tam(cartao({ titulo: 'Composição (estados)', corpo: composicao([{ rotulo: 'Online', valor: 1201, cor: 'ok' }, { rotulo: 'Offline', valor: 83, cor: 'neutro' }, { rotulo: 'Aguardando', valor: 4, cor: 'aviso' }]) }), 6),
      tam(cartao({ titulo: 'Sparkline', corpo: sparkline([3, 5, 4, 8, 6, 9, 12, 10, 14]) }), 4))),
    secao('vazios', 'Estados vazios ilustrados', h('div', { class: 'grade-3' }, ['farol', 'busca', 'tudo-ok', 'caixa', 'erro'].map((il) =>
      h('div', { class: 'cartao' }, vazio({ titulo: il, texto: 'Texto explicando o que fazer.', ilustracao: il, compacto: true }))))),
    secao('ícones', 'Ícones', h('div', { class: 'cartao cartao-corpo' }, h('div', { class: 'linha', estilo: { gap: '16px 20px' } },
      h('div', { class: 'pilha-2 centro', estilo: { width: '64px' } }, logo(), h('small', { class: 'sutil', text: 'logo' })),
      NOMES_ICONES.map((n) => h('div', { class: 'pilha-2', estilo: { width: '64px', alignItems: 'center' }, title: n }, icone(n, { tamanho: 20 }), h('small', { class: 'sutil', estilo: { fontSize: '10px' }, text: n }))))))));
}

export default {
  nome: 'estilo',
  iniciar(farol) {
    farol.rota('/estilo', { titulo: 'Design system', render: pagina });
    farol.comando({ id: 'estilo', rotulo: 'Guia de estilo (design system)', icone: 'paleta', secao: 'Desenvolvimento', palavras: 'componentes tokens', executar: () => { location.hash = '#/estilo'; } });
  },
};
