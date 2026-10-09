// Gaveta "Adicionar dispositivo": escolhe o site, gera o token de instalação e mostra o comando pronto.
import { h, preencher } from '../../nucleo/dom.js';
import { icone } from '../../nucleo/icones.js';
import { get, post } from '../../nucleo/api.js';
import { estado } from '../../nucleo/estado.js';
import { relativo, fmtData } from '../../nucleo/formato.js';
import { gaveta, toast, toastErro } from '../../ui/camadas.js';
import { campo, select, input, botao, botaoCopiar, blocoMono, aviso, abas, selo, comCarregando } from '../../ui/componentes.js';

export function adicionarDispositivo() {
  gaveta({
    titulo: 'Adicionar dispositivo',
    descricao: 'Gere um token de instalação de uso único e rode o comando no computador.',
    conteudo: () => {
      const corpo = h('div', { class: 'pilha' });
      const sites = estado.clientes.flatMap((c) => c.sites.map((s) => [s.id, `${c.nome} · ${s.nome}`]));
      const siteSel = select(sites.length ? sites : [[1, 'Minha empresa']], estado.escopo.site ?? estado.clientes.find((c) => c.id === estado.escopo.cliente)?.sites[0]?.id ?? 1);
      const desc = input({ placeholder: 'Ex.: Notebook da recepção', attrs: { maxlength: 120 } });
      const gerar = botao('Gerar token de instalação', { variante: 'primario', icone: 'chave', tipo: 'submit' });
      const form = h('form', {
        class: 'form', onsubmit: (ev) => {
          ev.preventDefault();
          comCarregando(gerar, async () => {
            try {
              const r = await post('/api/tokens-instalacao', { site_id: Number(siteSel.value), ...(desc.value.trim() ? { descricao: desc.value.trim() } : {}) });
              preencher(corpo, resultado(r));
            } catch (e) { toastErro(e); }
          });
        },
      },
      h('ol', { class: 'passos' },
        h('li', {}, 'Escolha o site onde o dispositivo vai aparecer.'),
        h('li', {}, 'Gere o token (vale 24 h, uso único).'),
        h('li', {}, 'Rode o comando como administrador/root no computador.')),
      campo('Site', siteSel), campo('Descrição (opcional)', desc), gerar);
      corpo.append(form, tokensRecentes());
      return corpo;
    },
  });
}

function resultado(r) {
  let so = /win/i.test(navigator.userAgent) ? 'windows' : 'linux';
  const area = h('div', { class: 'pilha-2' });
  const desenhar = () => preencher(area,
    h('div', { class: 'linha-entre' }, h('span', { class: 'rotulo', text: so === 'windows' ? 'PowerShell como administrador' : 'Terminal (com sudo)' }),
      botaoCopiar(() => r.comandos[so], 'Copiar comando', { toast })),
    blocoMono(r.comandos[so], { classe: 'bloco-comando' }));
  desenhar();
  return h('div', { class: 'pilha' },
    aviso(h('span', {}, h('strong', { text: 'Token criado. ' }), `Ele não será mostrado de novo. Expira ${relativo(r.expira_em)} (${fmtData(r.expira_em)}).`), 'ok'),
    h('div', { class: 'campo' }, h('span', { class: 'rotulo', text: 'Token' }),
      h('div', { class: 'linha' }, h('code', { class: 'token-texto', text: r.token }), botaoCopiar(r.token, 'Copiar token', { toast }))),
    abas([{ id: 'windows', rotulo: 'Windows', icone: 'windows' }, { id: 'linux', rotulo: 'Linux', icone: 'linux' }], so, (v) => { so = v; desenhar(); }, 'Sistema operacional'),
    area,
    h('p', { class: 'ajuda' }, 'Requisitos: Python 3.10+ e o pacote psutil. O agente abre um canal em tempo real com o servidor e aparece na lista em segundos. Para rodar como serviço, veja o README.'));
}

function tokensRecentes() {
  const lista = h('div', {});
  const det = h('details', { class: 'cartao', estilo: { padding: '12px 16px' } }, h('summary', { class: 'forte pequeno', estilo: { cursor: 'pointer' } }, 'Tokens recentes'), lista);
  det.addEventListener('toggle', async () => {
    if (!det.open || lista.childElementCount) return;
    try {
      const tokens = await get('/api/tokens-instalacao');
      preencher(lista, tokens.length ? h('ul', { class: 'lista-linhas mt-2' }, tokens.slice(0, 12).map((t) => h('li', {},
        h('div', { class: 'linha-item', estilo: { padding: '6px 0', minHeight: '0' } },
          h('div', { class: 'linha-texto' }, h('span', { text: t.descricao || `Token #${t.id}` }), h('small', { text: `${t.site_nome ?? ''} · por ${t.criado_por} · ${relativo(t.criado_em)}` })),
          t.usado_em ? selo(t.hostname ?? 'usado', 'ok', { icone: 'check' }) : t.expira_em < Date.now() ? selo('expirado') : selo('disponível', 'info')))))
        : h('p', { class: 'sutil pequeno mt-2', text: 'Nenhum token gerado ainda.' }));
    } catch (e) { toastErro(e); }
  });
  return det;
}

export { icone };
