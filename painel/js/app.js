// Ponto de entrada do painel: sessão, carregamento dos módulos (manifesto do servidor), shell, rotas e tempo real.
import { h, preencher } from './nucleo/dom.js';
import { get, post, definirAoNaoAutenticado } from './nucleo/api.js';
import { estado, conectarTempoReal, desconectarTempoReal } from './nucleo/estado.js';
import { carregarModulos } from './nucleo/registro.js';
import { montarShell } from './nucleo/shell.js';
import { iniciarRoteador, pararRoteador } from './nucleo/roteador.js';
import { iniciarAtalhosPaleta } from './nucleo/paleta.js';
import { telaLogin } from './nucleo/login.js';
import { toast } from './ui/camadas.js';
import { ativarDicas } from './ui/flutuante.js';
import { vazio, botao } from './ui/componentes.js';

const raiz = document.getElementById('app');
let modulosCarregados = false;

async function sair() {
  try { await post('/api/logout'); } catch { /* a sessão pode já ter expirado */ }
  desconectarTempoReal();
  location.hash = '#/';
  location.reload();
}

let avisou = false;
definirAoNaoAutenticado(() => {
  if (avisou) return;
  avisou = true;
  toast('Sua sessão expirou. Entre novamente.', 'aviso');
  desconectarTempoReal();
  pararRoteador();
  iniciar();
});

async function iniciar() {
  let e;
  try {
    e = await get('/api/estado');
  } catch {
    preencher(raiz, h('main', { class: 'tela-login' }, h('div', { class: 'cartao-login' },
      vazio({ titulo: 'Servidor indisponível', texto: 'Não foi possível falar com o servidor do Farol.', ilustracao: 'erro',
        acoes: [botao('Tentar de novo', { variante: 'primario', icone: 'atualizar', onclick: iniciar })] }))));
    return;
  }
  if (!e.autenticado) {
    preencher(raiz);
    document.title = 'Entrar · Farol';
    telaLogin(raiz, { precisaSetup: e.precisaSetup, aoEntrar: iniciar });
    return;
  }
  avisou = false;
  Object.assign(estado, {
    usuario: e.usuario, nome: e.nome, papel: e.papel, permissoes: new Set(e.permissoes),
    totpAtivo: e.totpAtivo, elevadoAte: e.elevadoAte, versao: e.versao,
  });
  if (!modulosCarregados) {
    const { modulos } = await get('/api/painel/modulos');
    const erros = await carregarModulos(modulos);
    modulosCarregados = true;
    if (erros.length) setTimeout(() => toast(`Módulo(s) com erro: ${erros.map((x) => x.nome).join(', ')}`, 'erro'), 500);
  }
  const main = montarShell(raiz, { sair });
  iniciarRoteador(main);
  conectarTempoReal();
}

ativarDicas();
iniciarAtalhosPaleta();
iniciar();
