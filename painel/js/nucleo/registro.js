// Registro central do painel. Cada módulo (js/modulos/<nome>/index.js) exporta
//   export default { nome: 'alertas', iniciar(farol) { farol.rota(...); farol.menu(...); ... } }
// e o núcleo o descobre pelo manifesto GET /api/painel/modulos (lista das pastas). Nenhum arquivo do
// núcleo precisa ser editado para acrescentar um módulo.
import { pode } from './estado.js';

const listas = {
  rotas: [], menu: [], abasDispositivo: [], acoesDispositivo: [], acoesLote: [], colunasDispositivo: [],
  widgets: [], secoesConfig: [], comandos: [], buscadores: [], notificacoes: [],
};
export const registro = listas;

const SECOES_MENU = ['Visão geral', 'Gerenciar', 'Automação', 'Monitoramento', 'Relatórios', 'Administração'];

function ordenar(lista) { lista.sort((a, b) => (a.ordem ?? 100) - (b.ordem ?? 100) || String(a.id).localeCompare(String(b.id))); }

function exigir(obj, campos, tipo) {
  for (const c of campos) if (obj[c] == null) throw new Error(`${tipo}: campo "${c}" é obrigatório`);
}

function unico(lista, obj, tipo) {
  if (lista.some((x) => x.id === obj.id)) throw new Error(`${tipo} "${obj.id}" já registrado`);
  lista.push(obj);
  ordenar(lista);
}

/** Converte '/dispositivos/:id' em regex com grupos nomeados. */
function compilar(padrao) {
  const fonte = padrao.replace(/\/:([a-zA-Z_]+)(\?)?/g, (_m, nome, opc) => (opc ? `(?:/(?<${nome}>[^/]+))?` : `/(?<${nome}>[^/]+)`));
  return new RegExp(`^${fonte}/?$`);
}

/** API entregue a cada módulo em iniciar(farol). */
export function criarApiModulo(nomeModulo) {
  const dono = { modulo: nomeModulo };
  return {
    modulo: nomeModulo,
    pode,

    /** farol.rota('/alertas', { titulo, render(el, { params, query }) → limpeza?, permissao?, menu?: idDoMenuAtivo, migalhas? }) */
    rota(padrao, def) {
      exigir(def, ['titulo', 'render'], 'rota');
      if (listas.rotas.some((r) => r.padrao === padrao)) throw new Error(`rota "${padrao}" já registrada`);
      listas.rotas.push({ ...dono, padrao, regex: compilar(padrao), ...def });
      // rotas fixas antes das com parâmetros
      listas.rotas.sort((a, b) => (a.padrao.includes(':') ? 1 : 0) - (b.padrao.includes(':') ? 1 : 0));
    },

    /** farol.menu({ id, rotulo, icone, secao, ordem, href, permissao, contador?: () => number }) */
    menu(def) {
      exigir(def, ['id', 'rotulo', 'icone', 'href'], 'menu');
      unico(listas.menu, { ...dono, secao: 'Gerenciar', ...def }, 'item de menu');
    },

    /** Aba no detalhe do dispositivo: { id, rotulo, ordem, permissao, render(el, { agente, recarregar }) → limpeza? } */
    abaDispositivo(def) { exigir(def, ['id', 'rotulo', 'render'], 'abaDispositivo'); unico(listas.abasDispositivo, { ...dono, ...def }, 'aba'); },

    /** Ação no cabeçalho do dispositivo: { id, rotulo, icone, ordem, permissao, primaria?, perigo?, emBreve?, menu?: true (vai para "Mais"), disponivel?(agente), executar(agente) } */
    acaoDispositivo(def) { exigir(def, ['id', 'rotulo', 'icone'], 'acaoDispositivo'); unico(listas.acoesDispositivo, { ...dono, ...def }, 'ação'); },

    /** Ação em massa na lista de dispositivos: { id, rotulo, icone, ordem, permissao, perigo?, executar(agentes) } */
    acaoLote(def) { exigir(def, ['id', 'rotulo', 'icone', 'executar'], 'acaoLote'); unico(listas.acoesLote, { ...dono, ...def }, 'ação em massa'); },

    /** Coluna da lista de dispositivos: { id, rotulo, largura ('120px' | 'minmax(..)'), ordem, padrao: visível?, render(linha) → Node|string, valor?(linha) p/ ordenar, num? } */
    colunaDispositivo(def) { exigir(def, ['id', 'rotulo', 'render'], 'colunaDispositivo'); unico(listas.colunasDispositivo, { ...dono, largura: '120px', padrao: true, ...def }, 'coluna'); },

    /** Widget do dashboard: { id, titulo, ordem, tamanho: 3|4|6|8|12, permissao, render(el, { escopo }) → limpeza? } */
    widget(def) { exigir(def, ['id', 'titulo', 'render'], 'widget'); unico(listas.widgets, { ...dono, tamanho: 6, ...def }, 'widget'); },

    /** Seção em Configurações: { id, rotulo, descricao, icone, ordem, permissao, render(el) → limpeza? } */
    secaoConfig(def) { exigir(def, ['id', 'rotulo', 'render'], 'secaoConfig'); unico(listas.secoesConfig, { ...dono, icone: 'config', ...def }, 'seção'); },

    /** Comando da paleta (Ctrl+K): { id, rotulo, descricao?, icone, secao?, palavras?, permissao, executar() } */
    comando(def) { exigir(def, ['id', 'rotulo', 'executar'], 'comando'); unico(listas.comandos, { ...dono, icone: 'seta', secao: 'Ações', ...def }, 'comando'); },

    /** Fonte de busca da paleta: { id, secao, ordem, permissao, buscar(q, sinal) → Promise<[{ rotulo, descricao, icone, href | executar }]> } */
    buscador(def) { exigir(def, ['id', 'secao', 'buscar'], 'buscador'); unico(listas.buscadores, { ...dono, ...def }, 'buscador'); },

    /**
     * Fonte do sino de notificações: { id, permissao, contar() → Promise<number>, listar() → Promise<[{ titulo, texto, quando, icone, tom, href }]>,
     *   eventos: ['alerta'] (eventos do servidor que mudam a contagem), href: link "ver todos" }
     */
    notificacoes(def) { exigir(def, ['id', 'contar', 'listar'], 'notificacoes'); unico(listas.notificacoes, { ...dono, eventos: [], ...def }, 'fonte de notificações'); },
  };
}

/** Itens visíveis para o usuário atual (filtra por permissão). */
export const visiveis = (lista) => lista.filter((x) => !x.permissao || pode(x.permissao));

export const secoesMenu = () => {
  const usadas = [...new Set(visiveis(listas.menu).map((m) => m.secao))];
  return usadas.sort((a, b) => (SECOES_MENU.indexOf(a) + 1 || 99) - (SECOES_MENU.indexOf(b) + 1 || 99));
};

/** Carrega os módulos listados pelo servidor. Um módulo com erro não derruba o painel. */
export async function carregarModulos(nomes) {
  const erros = [];
  for (const nome of nomes) {
    try {
      const mod = (await import(`../modulos/${nome}/index.js`)).default;
      if (!mod?.iniciar) throw new Error('index.js precisa de "export default { nome, iniciar(farol) }"');
      mod.iniciar(criarApiModulo(nome));
    } catch (e) {
      console.error(`Módulo do painel "${nome}" falhou:`, e);
      erros.push({ nome, erro: e.message });
    }
  }
  return erros;
}
