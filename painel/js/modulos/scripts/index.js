// Módulo Scripts: Meus scripts, Biblioteca, Execuções, ação "Executar script" (no dispositivo e em massa),
// aba Execuções do dispositivo, widget de últimas execuções e busca de scripts na paleta.
import { get } from '../../nucleo/api.js';
import { normalizar } from '../../nucleo/formato.js';
import { paginaMeus } from './meus.js';
import { paginaBiblioteca, abrirDetalhe } from './biblioteca.js';
import { paginaExecucoes, abaExecucoes, widgetExecucoes } from './execucoes.js';
import { executarScript } from './executar.js';

let cacheScripts = { em: 0, dados: null };

export default {
  nome: 'scripts',
  iniciar(farol) {
    farol.menu({ id: 'biblioteca', rotulo: 'Biblioteca', icone: 'biblioteca', secao: 'Automação', ordem: 10, href: '#/biblioteca', permissao: 'biblioteca.ver' });
    farol.menu({ id: 'scripts', rotulo: 'Meus scripts', icone: 'scripts', secao: 'Automação', ordem: 20, href: '#/scripts', permissao: 'scripts.ver' });
    farol.menu({ id: 'execucoes', rotulo: 'Execuções', icone: 'execucoes', secao: 'Automação', ordem: 30, href: '#/execucoes', permissao: 'jobs.ver' });
    farol.rota('/scripts', { titulo: 'Meus scripts', permissao: 'scripts.ver', render: paginaMeus });
    farol.rota('/scripts/:id', { titulo: 'Script', permissao: 'scripts.ver', menu: 'scripts', render: paginaMeus });
    farol.rota('/biblioteca', { titulo: 'Biblioteca de scripts', permissao: 'biblioteca.ver', render: paginaBiblioteca });
    farol.rota('/execucoes', { titulo: 'Execuções', permissao: 'jobs.ver', render: paginaExecucoes });

    farol.acaoDispositivo({ id: 'executar-script', rotulo: 'Executar script', icone: 'play', ordem: 10, primaria: true, permissao: 'scripts.executar',
      executar: (a) => executarScript({ agentes: [a] }) });
    farol.acaoLote({ id: 'executar-script', rotulo: 'Executar script', icone: 'play', ordem: 10, primaria: true, permissao: 'scripts.executar',
      executar: (sel) => executarScript({ agentes: sel }) });
    farol.abaDispositivo({ id: 'execucoes', rotulo: 'Execuções', icone: 'execucoes', ordem: 50, permissao: 'jobs.ver', render: abaExecucoes });
    farol.widget({ id: 'execucoes', titulo: 'Últimas execuções', ordem: 60, tamanho: 12, permissao: 'jobs.ver', render: widgetExecucoes });

    farol.comando({ id: 'executar-script', rotulo: 'Executar script…', descricao: 'Escolher script e alvo', icone: 'play', palavras: 'rodar job automação', permissao: 'scripts.executar', executar: () => executarScript() });
    farol.comando({ id: 'novo-script', rotulo: 'Novo script', icone: 'mais', palavras: 'criar escrever', permissao: 'scripts.editar', executar: () => { location.hash = '#/scripts/novo'; } });
    farol.buscador({ id: 'scripts', secao: 'Meus scripts', ordem: 20, permissao: 'scripts.ver', buscar: async (q) => {
      if (!cacheScripts.dados || Date.now() - cacheScripts.em > 30_000) cacheScripts = { em: Date.now(), dados: await get('/api/scripts') };
      const t = normalizar(q).split(/\s+/).filter(Boolean);
      return cacheScripts.dados.filter((s) => t.every((x) => normalizar(`${s.nome} ${s.descricao} ${s.categoria}`).includes(x)))
        .map((s) => ({ rotulo: s.nome, descricao: s.categoria, icone: 'scripts', href: `#/scripts/${s.id}` }));
    } });
    farol.buscador({ id: 'biblioteca', secao: 'Biblioteca', ordem: 30, permissao: 'biblioteca.ver', buscar: async (q, sinal) => {
      const r = await get(`/api/biblioteca?q=${encodeURIComponent(q)}`, { sinal });
      return r.itens.map((s) => ({ rotulo: s.nome, descricao: `${s.categoria} · ${s.descricao}`, icone: 'biblioteca', executar: () => abrirDetalhe(s.id) }));
    } });
  },
};
