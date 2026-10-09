// Fluxo "Executar script": escolher o script (seus ou da biblioteca), o alvo, preencher as variáveis e confirmar com 2FA.
import { h, preencher, debounce } from '../../nucleo/dom.js';
import { icone, iconeSo } from '../../nucleo/icones.js';
import { get, post } from '../../nucleo/api.js';
import { estado } from '../../nucleo/estado.js';
import { NOMES_SHELL, NOMES_SO, normalizar, fmtInt, soChave } from '../../nucleo/formato.js';
import { gaveta, toast, toastErro } from '../../ui/camadas.js';
import { campo, select, input, botao, selo, skeleton, busca, aviso, segmentado, comCarregando } from '../../ui/componentes.js';
import { formularioVariaveis } from '../../ui/formulario.js';
import { comElevacao } from '../../ui/elevar.js';

export function selosScript(s) {
  return h('span', { class: 'linha gap-1' }, selo(NOMES_SHELL[s.shell] ?? s.shell, 'neutro', { classe: 'selo-mono' }),
    (s.so ?? []).map((so) => selo(NOMES_SO[so] ?? so, 'neutro')), s.tipo && s.tipo !== 'acao' ? selo(s.tipo === 'monitor' ? 'Monitor' : 'Auditoria', 'info') : null);
}

/**
 * Abre a gaveta de execução.
 * @param {{ script?: object, biblioteca?: object, agentes?: object[] }} o
 *   script = script do usuário (com id) · biblioteca = item da biblioteca (com id e variaveis) · agentes = alvo pré-escolhido
 */
export function executarScript(o = {}) {
  let escolhido = o.script ? { ...o.script, origem: 'script' } : o.biblioteca ? { ...o.biblioteca, origem: 'biblioteca', timeout: o.biblioteca.tempo_limite } : null;
  const agentesFixos = o.agentes ?? null;
  let modoAlvo = agentesFixos ? 'fixos' : 'todos';

  gaveta({
    titulo: 'Executar script', larga: false,
    descricao: agentesFixos ? `Em ${agentesFixos.length === 1 ? agentesFixos[0].hostname : `${agentesFixos.length} dispositivos`}` : 'Escolha o script e onde ele roda.',
    conteudo: (fechar) => {
      const corpo = h('div', { class: 'pilha' });
      const desenhar = () => preencher(corpo, escolhido ? passoConfigurar(fechar) : passoEscolher());
      const passoEscolher = () => {
        const lista = h('div', {}, skeleton(6));
        const campoBusca = busca('Buscar em seus scripts e na biblioteca…');
        let fonte = 'meus';
        let itens = { meus: null, biblioteca: null };
        const render = () => {
          const t = normalizar(campoBusca.input.value).split(/\s+/).filter(Boolean);
          const dados = (itens[fonte] ?? []).filter((s) => t.every((x) => normalizar(`${s.nome} ${s.descricao} ${s.categoria}`).includes(x)));
          preencher(lista, itens[fonte] == null ? skeleton(6) : dados.length ? h('ul', { class: 'lista-linhas cartao' }, dados.slice(0, 80).map((s) => h('li', {},
            h('button', { class: 'linha-item', type: 'button', onclick: () => { escolhido = { ...s, origem: fonte === 'meus' ? 'script' : 'biblioteca', timeout: s.timeout ?? s.tempo_limite }; desenhar(); } },
              h('div', { class: 'linha-texto' }, h('span', { class: 'forte', text: s.nome }), h('small', { text: s.descricao || s.categoria })), selosScript(s)))))
            : h('p', { class: 'sutil pequeno centro', text: 'Nenhum script encontrado.' }));
        };
        const carregar = async (f) => {
          if (itens[f]) return render();
          try { itens[f] = f === 'meus' ? await get('/api/scripts') : (await get('/api/biblioteca')).itens; } catch (e) { toastErro(e); itens[f] = []; }
          render();
        };
        campoBusca.input.addEventListener('input', debounce(render, 100));
        carregar('meus');
        return [h('div', { class: 'linha' }, segmentado([['meus', 'Meus scripts'], ['biblioteca', 'Biblioteca']], fonte, (v) => { fonte = v; carregar(v); }, 'Origem')),
          campoBusca.el, lista];
      };

      const passoConfigurar = (fecharGaveta) => {
        const s = escolhido;
        const vars = formularioVariaveis(s.variaveis ?? []);
        const timeout = input({ tipo: 'number', valor: s.timeout ?? 60, classe: 'input-curto', attrs: { min: 5, max: 86400 } });
        const alvoArea = h('div', {});
        const resumoAlvo = h('p', { class: 'sutil pequeno' });
        let escolhaAlvo = null;

        const desenharAlvo = () => {
          if (modoAlvo === 'fixos') {
            const incompat = agentesFixos.filter((a) => s.so?.length && soChave(a.so) && !s.so.includes(soChave(a.so)));
            preencher(alvoArea, h('div', { class: 'chips' }, agentesFixos.slice(0, 12).map((a) => h('span', { class: 'chip' }, iconeSo(a.so), a.hostname)),
              agentesFixos.length > 12 ? h('span', { class: 'chip', text: `+${agentesFixos.length - 12}` }) : null),
            incompat.length ? aviso(`${incompat.length} dispositivo(s) não são compatíveis com este script (${(s.so ?? []).map((x) => NOMES_SO[x]).join(', ')}) e serão ignorados.`, 'alerta') : null);
            escolhaAlvo = { agentes: agentesFixos.map((a) => a.id) };
            return;
          }
          const opcoesSites = estado.clientes.flatMap((c) => c.sites.map((x) => [`site:${x.id}`, `Site · ${c.nome} · ${x.nome} (${x.dispositivos})`]));
          const opcoesClientes = estado.clientes.map((c) => [`cliente:${c.id}`, `Cliente · ${c.nome} (${c.dispositivos})`]);
          const padrao = estado.escopo.site ? `site:${estado.escopo.site}` : estado.escopo.cliente ? `cliente:${estado.escopo.cliente}` : 'todos';
          const sel = select([['todos', `Todos os dispositivos (${fmtInt(estado.clientes.reduce((n, c) => n + c.dispositivos, 0))})`], ...opcoesClientes, ...opcoesSites], padrao);
          const atualizar = () => {
            const [tipo, id] = sel.value.split(':');
            escolhaAlvo = { alvo: tipo === 'todos' ? { tipo: 'todos' } : { tipo, id: Number(id) } };
            resumoAlvo.textContent = 'Dispositivos offline executam quando voltarem. Os incompatíveis com o sistema do script são ignorados.';
          };
          sel.addEventListener('change', atualizar);
          atualizar();
          preencher(alvoArea, campo('Onde executar', sel), resumoAlvo);
        };
        desenharAlvo();

        const executar = botao('Executar agora', { variante: 'primario', icone: 'play' });
        executar.addEventListener('click', () => {
          if (!vars.validar()) return;
          const corpo = { ...escolhaAlvo, ...(s.origem === 'script' ? { script_id: s.id } : { biblioteca_id: s.id }), variaveis: vars.valores(), timeout: Number(timeout.value) || undefined };
          if (!Object.keys(corpo.variaveis).length) delete corpo.variaveis;
          comCarregando(executar, async () => {
            const r = await comElevacao(`Executar “${s.nome}”.`, () => post('/api/executar', corpo));
            if (!r) return;
            fecharGaveta(r);
            toast(`${r.jobs.length} execução(ões) na fila${r.ignorados?.length ? ` · ${r.ignorados.length} ignorada(s) por incompatibilidade` : ''}.`, 'sucesso', { titulo: s.nome });
            if (agentesFixos?.length === 1) location.hash = `#/dispositivos/${agentesFixos[0].id}?aba=execucoes`;
          });
        });

        return [
          h('div', { class: 'cartao', estilo: { padding: '14px 16px' } },
            h('div', { class: 'linha-entre' }, h('div', { class: 'cresce' }, h('div', { class: 'forte', text: s.nome }), h('div', { class: 'sutil pequeno', text: s.descricao || s.categoria || '' })),
              o.script || o.biblioteca ? null : botao('Trocar', { tamanho: 'pequeno', onclick: () => { escolhido = null; desenhar(); } })),
            h('div', { class: 'mt-2' }, selosScript(s)),
            s.requer_admin ? h('p', { class: 'pequeno sutil mt-2' }, icone('escudo', { tamanho: 13 }), ' Roda com privilégios de administrador (o agente executa como SYSTEM/root).') : null),
          h('h3', { text: 'Alvo' }), alvoArea,
          (s.variaveis ?? []).length ? [h('h3', { text: 'Variáveis' }), h('p', { class: 'sutil pequeno', text: 'Os valores chegam ao script como variáveis de ambiente FAROL_<NOME>.' }), vars.el] : null,
          h('details', {}, h('summary', { class: 'pequeno sutil', estilo: { cursor: 'pointer' } }, 'Opções avançadas'),
            h('div', { class: 'mt-3' }, campo('Tempo limite (segundos)', timeout, { ajuda: 'O agente encerra o processo (e os filhos) ao estourar.' }))),
          h('div', { class: 'linha-entre mt-2' }, h('span', { class: 'sutil pequeno' }, icone('cadeado', { tamanho: 13 }), ' Pede confirmação 2FA · fica na auditoria'), executar),
        ];
      };
      desenhar();
      return corpo;
    },
  });
}

/** Comando rápido (uma linha ou um bloco) num dispositivo. */
export async function comandoRapido(agente, comando, shell) {
  return comElevacao(`Executar um comando em ${agente.hostname}.`, () => post('/api/executar', { agentes: [agente.id], comando, shell, timeout: 120 }));
}
