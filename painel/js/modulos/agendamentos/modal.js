// Criar/editar agendamento: mesmo fluxo de duas etapas (escolher script → configurar) usado em
// "Executar script" (scripts/executar.js), mas em vez de rodar uma vez, grava o agendamento no servidor.
import { h, preencher, debounce } from '../../nucleo/dom.js';
import { icone } from '../../nucleo/icones.js';
import { get, post, put } from '../../nucleo/api.js';
import { estado } from '../../nucleo/estado.js';
import { NOMES_SHELL, NOMES_SO, normalizar, fmtInt, relativo } from '../../nucleo/formato.js';
import { gaveta, toast, toastErro } from '../../ui/camadas.js';
import { campo, select, input, botao, selo, skeleton, busca, segmentado, comCarregando } from '../../ui/componentes.js';
import { formularioVariaveis } from '../../ui/formulario.js';
import { comElevacao } from '../../ui/elevar.js';

const PRESETS_INTERVALO = [[15, '15 min'], [60, '1 h'], [360, '6 h'], [720, '12 h'], [1440, '1 dia'], [10080, '1 semana']];
const PRESETS_CRON = [
  ['0 * * * *', 'De hora em hora'], ['0 3 * * *', 'Todo dia às 3h'], ['0 8 * * 1', 'Toda segunda às 8h'], ['*/15 * * * *', 'A cada 15 min'],
];

let cacheAgentes = null;
async function obterAgentes() {
  if (!cacheAgentes) cacheAgentes = get('/api/agentes').catch(() => []);
  return cacheAgentes;
}

/**
 * Abre o formulário de criar/editar. Passe `agendamento` para editar, ou `script`/`biblioteca` para
 * pré-selecionar a origem (atalho a partir da tela de Scripts/Biblioteca).
 */
export async function abrirAgendamentoModal({ agendamento = null, script = null, biblioteca = null } = {}) {
  let escolhido = script ? { ...script, origem: 'script' } : biblioteca ? { ...biblioteca, origem: 'biblioteca', timeout: biblioteca.tempo_limite } : null;
  if (agendamento && !escolhido) {
    try {
      if (agendamento.script_id) escolhido = { ...(await get(`/api/scripts/${agendamento.script_id}`)), origem: 'script' };
      else { const b = await get(`/api/biblioteca/${agendamento.biblioteca_id}`); escolhido = { ...b, origem: 'biblioteca', timeout: b.tempo_limite }; }
    } catch (e) {
      toastErro(e);
      return;
    }
  }

  gaveta({
    titulo: agendamento ? 'Editar agendamento' : 'Novo agendamento',
    descricao: agendamento ? agendamento.nome : 'Escolha o script, quando ele roda e em quais dispositivos.',
    conteudo: (fecharGaveta) => {
      const corpo = h('div', { class: 'pilha' });
      const desenhar = () => preencher(corpo, escolhido ? passoConfigurar() : passoEscolher());

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
              h('div', { class: 'linha-texto' }, h('span', { class: 'forte', text: s.nome }), h('small', { text: s.descricao || s.categoria })),
              selo(NOMES_SHELL[s.shell] ?? s.shell, 'neutro')))))
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

      const passoConfigurar = () => {
        const s = escolhido;
        const defs = (s.variaveis ?? []).map((d) => (agendamento?.variaveis?.[d.nome] !== undefined ? { ...d, padrao: agendamento.variaveis[d.nome] } : d));
        const vars = formularioVariaveis(defs);
        const nome = input({ valor: agendamento?.nome ?? `${s.nome}`, attrs: { required: true, maxlength: 150 } });
        const timeout = input({ tipo: 'number', valor: agendamento?.timeout ?? s.timeout ?? 60, classe: 'input-curto', attrs: { min: 5, max: 86400 } });

        // ---- agenda (intervalo ou cron) ----
        let tipoAgenda = agendamento?.tipo ?? 'intervalo';
        const intervalo = input({ tipo: 'number', valor: agendamento?.intervalo_min ?? 60, classe: 'input-curto', attrs: { min: 1, max: 10080 } });
        const cron = input({ valor: agendamento?.cron ?? '', classe: 'input-mono', placeholder: '0 3 * * *' });
        const agendaArea = h('div', {});
        const desenharAgenda = () => preencher(agendaArea, tipoAgenda === 'intervalo'
          ? [campo('A cada (minutos)', intervalo, { ajuda: '60 = de hora em hora · 1440 = uma vez por dia · 10080 = uma vez por semana' }),
            h('div', { class: 'chips mt-2' }, PRESETS_INTERVALO.map(([min, rotulo]) => h('button', { class: 'chip', type: 'button', onclick: () => { intervalo.value = min; } }, rotulo)))]
          : [campo('Expressão cron', cron, { ajuda: 'minuto hora dia mês dia-da-semana (0-6, domingo = 0) · hora do servidor' }),
            h('div', { class: 'chips mt-2' }, PRESETS_CRON.map(([expr, rotulo]) => h('button', { class: 'chip', type: 'button', onclick: () => { cron.value = expr; } }, rotulo)))]);
        desenharAgenda();
        const segAgenda = segmentado([['intervalo', 'A cada...'], ['cron', 'Expressão cron']], tipoAgenda, (v) => { tipoAgenda = v; desenharAgenda(); }, 'Tipo de agenda');

        // ---- alvo ----
        const totalDispositivos = estado.clientes.reduce((n, c) => n + c.dispositivos, 0);
        const opcoesSites = estado.clientes.flatMap((c) => c.sites.map((x) => [`site:${x.id}`, `Site · ${c.nome} · ${x.nome} (${x.dispositivos})`]));
        const opcoesClientes = estado.clientes.map((c) => [`cliente:${c.id}`, `Cliente · ${c.nome} (${c.dispositivos})`]);
        const alvoInicial = agendamento?.alvo;
        const valorInicial = !alvoInicial || alvoInicial.tipo === 'todos' ? 'todos' : alvoInicial.tipo === 'agente' ? 'agente' : `${alvoInicial.tipo}:${alvoInicial.id}`;
        const selAlvo = select([['todos', `Todos os dispositivos (${fmtInt(totalDispositivos)})`], ...opcoesClientes, ...opcoesSites, ['agente', 'Um dispositivo específico…']], valorInicial);
        const areaAgente = h('div', {});
        const desenharAgente = async () => {
          if (selAlvo.value !== 'agente') { preencher(areaAgente); return; }
          preencher(areaAgente, skeleton(1));
          const agentes = await obterAgentes();
          const selAgente = select(agentes.map((a) => [a.id, `${a.hostname}${a.site_nome ? ` · ${a.site_nome}` : ''}`]), alvoInicial?.tipo === 'agente' ? alvoInicial.id : agentes[0]?.id);
          selAgente.dataset.campoAgente = '1';
          preencher(areaAgente, campo('Dispositivo', selAgente));
        };
        selAlvo.addEventListener('change', desenharAgente);
        desenharAgente();

        const salvar = botao(agendamento ? 'Salvar' : 'Criar agendamento', { variante: 'primario', icone: 'check' });
        salvar.addEventListener('click', () => {
          if (!nome.value.trim()) { toast('Dê um nome ao agendamento.', 'erro'); nome.focus(); return; }
          if (!vars.validar()) return;
          let alvo;
          if (selAlvo.value === 'todos') alvo = { tipo: 'todos' };
          else if (selAlvo.value === 'agente') {
            const selAgente = areaAgente.querySelector('[data-campo-agente]');
            if (!selAgente?.value) { toast('Escolha um dispositivo.', 'erro'); return; }
            alvo = { tipo: 'agente', id: selAgente.value };
          } else {
            const [tipo, id] = selAlvo.value.split(':');
            alvo = { tipo, id: Number(id) };
          }
          if (tipoAgenda === 'intervalo' && !(Number(intervalo.value) >= 1)) { toast('Informe o intervalo em minutos.', 'erro'); intervalo.focus(); return; }
          if (tipoAgenda === 'cron' && !cron.value.trim()) { toast('Informe a expressão cron.', 'erro'); cron.focus(); return; }

          const corpoBase = {
            nome: nome.value.trim(), ...(s.origem === 'script' ? { script_id: s.id } : { biblioteca_id: s.id }),
            variaveis: vars.valores(), timeout: Number(timeout.value) || undefined, alvo,
            tipo: tipoAgenda, ...(tipoAgenda === 'intervalo' ? { intervalo_min: Number(intervalo.value) } : { cron: cron.value.trim() }),
          };
          if (!Object.keys(corpoBase.variaveis).length) delete corpoBase.variaveis;

          comCarregando(salvar, async () => {
            const r = await comElevacao(agendamento ? `Editar o agendamento "${corpoBase.nome}".` : `Criar o agendamento "${corpoBase.nome}".`,
              () => (agendamento ? put(`/api/agendamentos/${agendamento.id}`, corpoBase) : post('/api/agendamentos', corpoBase)));
            if (!r) return;
            fecharGaveta(r);
            toast(agendamento ? 'Agendamento atualizado.' : `Agendamento criado. Próxima execução ${relativo(r.proxima_execucao)}.`, 'sucesso', { titulo: corpoBase.nome });
          });
        });

        return [
          h('div', { class: 'cartao', estilo: { padding: '14px 16px' } },
            h('div', { class: 'linha-entre' }, h('div', { class: 'cresce' }, h('div', { class: 'forte', text: s.nome }), h('div', { class: 'sutil pequeno', text: s.descricao || s.categoria || '' })),
              agendamento || script || biblioteca ? null : botao('Trocar', { tamanho: 'pequeno', onclick: () => { escolhido = null; desenhar(); } })),
            h('div', { class: 'mt-2' }, selo(NOMES_SHELL[s.shell] ?? s.shell, 'neutro'), (s.so ?? []).map((so) => selo(NOMES_SO[so] ?? so, 'neutro')))),
          campo('Nome do agendamento', nome, { obrigatorio: true }),
          h('h3', { text: 'Quando roda' }), segAgenda, agendaArea,
          h('h3', { text: 'Onde roda' }), campo('Alvo', selAlvo), areaAgente,
          (s.variaveis ?? []).length ? [h('h3', { text: 'Variáveis' }), h('p', { class: 'sutil pequeno', text: 'Chegam ao script como variáveis de ambiente FAROL_<NOME>.' }), vars.el] : null,
          h('details', {}, h('summary', { class: 'pequeno sutil', estilo: { cursor: 'pointer' } }, 'Opções avançadas'),
            h('div', { class: 'mt-3' }, campo('Tempo limite por execução (segundos)', timeout))),
          h('div', { class: 'linha-entre mt-2' }, h('span', { class: 'sutil pequeno' }, icone('cadeado', { tamanho: 13 }), ' Pede confirmação 2FA · fica na auditoria'), salvar),
        ];
      };
      desenhar();
      return corpo;
    },
  });
}
