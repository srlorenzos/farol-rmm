// Roteamento por hash (#/caminho?query). As rotas vêm do registro; a página é renderizada dentro do <main>.
// Uma página pode devolver uma função de limpeza (cancelar assinaturas, timers). Mudança de escopo
// (cliente/site) re-renderiza a página atual.
import { h, limpar } from './dom.js';
import { registro } from './registro.js';
import { pode, aoEvento } from './estado.js';
import { desenharMenu } from './shell.js';
import { vazio, botao } from '../ui/componentes.js';

let conteudo = null;
let limpeza = null;
let rotaAtual = null;

export function iniciarRoteador(main) {
  conteudo = main;
  window.addEventListener('hashchange', rotear);
  aoEvento('escopo', () => rotear({ manterRolagem: true }));
  rotear();
}

export function pararRoteador() {
  window.removeEventListener('hashchange', rotear);
  limpeza?.();
  limpeza = null;
  conteudo = null;
}

function menuDaRota(rota, caminho) {
  if (rota?.menu) return rota.menu;
  const m = registro.menu.filter((x) => caminho === x.href.slice(1) || caminho.startsWith(`${x.href.slice(1)}/`))
    .sort((a, b) => b.href.length - a.href.length)[0];
  return m?.id ?? (caminho === '/' ? registro.menu.find((x) => x.href === '#/')?.id : null);
}

export function rotear(opcoes = {}) {
  if (!conteudo) return;
  const [caminho, busca = ''] = (location.hash.slice(1) || '/').split('?');
  let params = {};
  const rota = registro.rotas.find((r) => {
    const m = r.regex.exec(caminho);
    if (m) params = Object.fromEntries(Object.entries(m.groups ?? {}).map(([k, v]) => [k, v && decodeURIComponent(v)]));
    return !!m;
  });
  try { limpeza?.(); } catch (e) { console.error(e); }
  limpeza = null;
  limpar(conteudo);
  desenharMenu(menuDaRota(rota, caminho));
  const pagina = h('div', { class: 'pagina' });
  conteudo.append(pagina);
  if (!rota) {
    document.title = 'Página não encontrada · Farol';
    pagina.append(vazio({ titulo: 'Página não encontrada', texto: 'O endereço não corresponde a nenhuma página do painel.', ilustracao: 'busca',
      acoes: [botao('Ir para o painel', { variante: 'primario', href: '#/' })] }));
    return;
  }
  if (rota.permissao && !pode(rota.permissao)) {
    document.title = `Sem acesso · Farol`;
    pagina.append(vazio({ titulo: 'Sem acesso', texto: 'Seu papel não permite abrir esta página. Fale com um administrador.', ilustracao: 'erro' }));
    return;
  }
  document.title = `${rota.titulo} · Farol`;
  rotaAtual = rota;
  try {
    limpeza = rota.render(pagina, { params, query: new URLSearchParams(busca) }) || null;
  } catch (e) {
    console.error(e);
    pagina.append(vazio({ titulo: 'Algo deu errado nesta página', texto: e.message, ilustracao: 'erro' }));
  }
  if (!opcoes.manterRolagem) { conteudo.scrollTop = 0; window.scrollTo(0, 0); }
}

export const rotaAtiva = () => rotaAtual;
