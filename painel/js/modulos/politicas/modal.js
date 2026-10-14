// Criar/editar política: exceções de alerta (3 estados por tipo: não incluir / desligado / personalizado,
// igual ao modal de exceção por dispositivo em alertas) + uma lista de moldes de agendamento (mesmo
// seletor de script de "Executar script"/Agendamentos, sem o alvo — o alvo só é escolhido na hora de
// aplicar a política, não aqui).
import { h, preencher, debounce } from '../../nucleo/dom.js';
import { get, post, put } from '../../nucleo/api.js';
import { campo, select, input, botao, botaoIcone, selo, skeleton, busca, segmentado, comCarregando } from '../../ui/componentes.js';
import { gaveta, modal, toast, toastErro } from '../../ui/camadas.js';
import { comElevacao } from '../../ui/elevar.js';

const TIPOS = [['cpu', 'CPU', '%', 'limite'], ['ram', 'Memória', '%', 'limite'], ['disco', 'Disco', '%', 'limite'], ['offline', 'Offline', 'min', 'minutos']];

function abrirEscolherScript() {
  return modal({
    titulo: 'Escolher script', largura: 'md',
    conteudo: (fechar) => {
      const lista = h('div', {}, skeleton(6));
      const campoBusca = busca('Buscar em seus scripts e na biblioteca…');
      let fonte = 'meus';
      const itens = { meus: null, biblioteca: null };
      const normalizar = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
      const render = () => {
        const t = normalizar(campoBusca.input.value).split(/\s+/).filter(Boolean);
        const dados = (itens[fonte] ?? []).filter((s) => t.every((x) => normalizar(`${s.nome} ${s.descricao} ${s.categoria}`).includes(x)));
        preencher(lista, itens[fonte] == null ? skeleton(6) : dados.length ? h('ul', { class: 'lista-linhas cartao' }, dados.slice(0, 80).map((s) => h('li', {},
          h('button', { class: 'linha-item', type: 'button', onclick: () => fechar({ ...s, origem: fonte === 'meus' ? 'script' : 'biblioteca' }) },
            h('div', { class: 'linha-texto' }, h('span', { class: 'forte', text: s.nome }), h('small', { text: s.descricao || s.categoria }))))))
          : h('p', { class: 'sutil pequeno centro', text: 'Nenhum script encontrado.' }));
      };
      const carregar = async (f) => {
        if (itens[f]) return render();
        try { itens[f] = f === 'meus' ? await get('/api/scripts') : (await get('/api/biblioteca')).itens; } catch (e) { toastErro(e); itens[f] = []; }
        render();
      };
      campoBusca.input.addEventListener('input', debounce(render, 100));
      carregar('meus');
      return h('div', { class: 'pilha' }, h('div', { class: 'linha' }, segmentado([['meus', 'Meus scripts'], ['biblioteca', 'Biblioteca']], fonte, (v) => { fonte = v; carregar(v); }, 'Origem')),
        campoBusca.el, lista);
    },
  }).promessa;
}

function blocoOverride(tipo, nome, sufixo, chave, atual) {
  let modo = !atual ? 'nenhum' : atual.ativo === false ? 'desligado' : 'personalizado';
  const temCiclos = tipo === 'cpu' || tipo === 'ram';
  const campoValor = input({ tipo: 'number', valor: atual?.[chave] ?? (chave === 'minutos' ? 5 : 90), classe: 'input-curto', attrs: { min: 1, max: chave === 'minutos' ? 10080 : 100 } });
  const campoCiclos = temCiclos ? input({ tipo: 'number', valor: atual?.ciclos ?? 4, classe: 'input-curto', attrs: { min: 1, max: 100 } }) : null;
  const areaPersonalizado = h('div', { class: 'linha mt-2', hidden: modo !== 'personalizado' },
    h('label', { class: 'linha pequeno muted' }, chave === 'minutos' ? 'Por mais de' : 'Acima de', campoValor, sufixo),
    temCiclos ? h('label', { class: 'linha pequeno muted' }, 'por', campoCiclos, 'check-ins') : null);
  const seg = segmentado([['nenhum', 'Não incluir'], ['desligado', 'Desligado'], ['personalizado', 'Personalizado']], modo, (v) => { modo = v; areaPersonalizado.hidden = modo !== 'personalizado'; }, `${nome}: modo`);
  return {
    tipo,
    el: h('fieldset', { class: 'cartao', estilo: { padding: '14px' } }, h('legend', { class: 'sr', text: nome }),
      h('div', { class: 'forte mb-2', text: nome }), seg, areaPersonalizado),
    coletar() {
      if (modo === 'nenhum') return undefined;
      if (modo === 'desligado') return { ativo: false };
      return chave === 'minutos' ? { ativo: true, minutos: Number(campoValor.value) } : { ativo: true, limite: Number(campoValor.value), ...(temCiclos ? { ciclos: Number(campoCiclos.value) } : {}) };
    },
  };
}

function blocoAgendamento(tpl, remover) {
  let escolhido = tpl?.script_id ? { id: tpl.script_id, origem: 'script', nome: tpl._nomeScript ?? `Script #${tpl.script_id}` }
    : tpl?.biblioteca_id ? { id: tpl.biblioteca_id, origem: 'biblioteca', nome: tpl._nomeScript ?? tpl.biblioteca_id } : null;
  const nome = input({ valor: tpl?.nome ?? '', placeholder: 'Nome do agendamento', attrs: { required: true, maxlength: 150 } });
  const areaScript = h('div', {});
  let tipoAgenda = tpl?.tipo ?? 'intervalo';
  const intervalo = input({ tipo: 'number', valor: tpl?.intervalo_min ?? 60, classe: 'input-curto', attrs: { min: 1, max: 10080 } });
  const cron = input({ valor: tpl?.cron ?? '', classe: 'input-mono', placeholder: '0 3 * * *' });
  const areaAgenda = h('div', {});
  const desenharAgenda = () => preencher(areaAgenda, tipoAgenda === 'intervalo'
    ? h('label', { class: 'linha pequeno muted' }, 'A cada', intervalo, 'min')
    : h('label', { class: 'linha pequeno muted' }, 'Cron', cron));
  const segAgenda = segmentado([['intervalo', 'A cada...'], ['cron', 'Cron']], tipoAgenda, (v) => { tipoAgenda = v; desenharAgenda(); }, 'Tipo de agenda');
  desenharAgenda();
  function desenharScript() {
    preencher(areaScript, escolhido
      ? h('div', { class: 'linha-entre' }, h('span', { class: 'pequeno', text: escolhido.nome }), botao('Trocar', { tamanho: 'pequeno', onclick: escolher }))
      : h('div', { class: 'linha-entre' }, h('span', { class: 'sutil pequeno', text: 'Nenhum script escolhido' }), botao('Escolher script…', { tamanho: 'pequeno', icone: 'scripts', onclick: escolher })));
  }
  async function escolher() { const s = await abrirEscolherScript(); if (s) { escolhido = s; desenharScript(); } }
  desenharScript();
  return {
    el: h('div', { class: 'cartao mt-2', estilo: { padding: '12px' } },
      h('div', { class: 'linha-entre' }, h('div', { class: 'cresce' }, campo('Nome', nome)), botaoIcone('fechar', 'Remover este molde', { pequeno: true, onclick: remover })),
      h('div', { class: 'mt-2' }, areaScript),
      h('div', { class: 'linha mt-2' }, segAgenda), areaAgenda),
    coletar() {
      if (!escolhido) return { erro: 'escolha um script' };
      return {
        nome: nome.value.trim(), [escolhido.origem === 'script' ? 'script_id' : 'biblioteca_id']: escolhido.id,
        tipo: tipoAgenda, ...(tipoAgenda === 'intervalo' ? { intervalo_min: Number(intervalo.value) } : { cron: cron.value.trim() }),
      };
    },
  };
}

export async function abrirPoliticaModal({ politica } = {}) {
  // Resolve o nome de cada script ANTES de abrir a gaveta, pra não mostrar "Script #5" nos moldes existentes.
  const agendamentosComNome = await Promise.all((politica?.agendamentos ?? []).map(async (tpl) => {
    try {
      const info = tpl.script_id ? await get(`/api/scripts/${tpl.script_id}`) : await get(`/api/biblioteca/${tpl.biblioteca_id}`);
      return { ...tpl, _nomeScript: info.nome };
    } catch { return tpl; }
  }));
  gaveta({
    titulo: politica ? 'Editar política' : 'Nova política', larga: true,
    descricao: 'Um pacote de exceções de alerta e agendamentos; o alvo só é escolhido na hora de aplicar.',
    conteudo: (fechar) => {
      const nome = input({ valor: politica?.nome ?? '', attrs: { required: true, maxlength: 120 } });
      const descricao = input({ valor: politica?.descricao ?? '', placeholder: 'Opcional', attrs: { maxlength: 500 } });

      const overridesAtual = politica?.overrides ?? {};
      const blocosOverride = TIPOS.map(([tipo, n, sufixo, chave]) => blocoOverride(tipo, n, sufixo, chave, overridesAtual[tipo]));

      const areaAgendamentos = h('div', {});
      const listaBlocos = [];
      function desenharAgendamentos() { preencher(areaAgendamentos, listaBlocos.map((b) => b.el)); }
      function adicionarMolde(tpl) {
        const bloco = blocoAgendamento(tpl, () => { const i = listaBlocos.indexOf(bloco); if (i >= 0) listaBlocos.splice(i, 1); desenharAgendamentos(); });
        listaBlocos.push(bloco);
        desenharAgendamentos();
      }
      agendamentosComNome.forEach((tpl) => adicionarMolde(tpl));

      const salvar = botao(politica ? 'Salvar' : 'Criar política', { variante: 'primario', icone: 'check' });
      salvar.addEventListener('click', () => {
        if (!nome.value.trim()) { toast('Dê um nome à política.', 'erro'); nome.focus(); return; }
        const overrides = {};
        for (const b of blocosOverride) { const v = b.coletar(); if (v !== undefined) overrides[b.tipo] = v; }
        const agendamentos = [];
        for (const b of listaBlocos) {
          const v = b.coletar();
          if (v.erro) { toast('Escolha um script para cada molde de agendamento.', 'erro'); return; }
          if (!v.nome) { toast('Dê um nome a cada molde de agendamento.', 'erro'); return; }
          agendamentos.push(v);
        }
        if (!Object.keys(overrides).length && !agendamentos.length) { toast('Inclua ao menos uma exceção de alerta ou um molde de agendamento.', 'erro'); return; }
        const corpo = { nome: nome.value.trim(), descricao: descricao.value.trim() || undefined, overrides, agendamentos };
        comCarregando(salvar, async () => {
          const r = await comElevacao(politica ? `Editar a política "${corpo.nome}".` : `Criar a política "${corpo.nome}".`,
            () => (politica ? put(`/api/politicas/${politica.id}`, corpo) : post('/api/politicas', corpo)));
          if (!r) return;
          fechar(r);
          toast(politica ? 'Política atualizada.' : 'Política criada.', 'sucesso', { titulo: corpo.nome });
        });
      });

      return [
        h('div', { class: 'grade-2' }, campo('Nome', nome, { obrigatorio: true }), campo('Descrição', descricao)),
        h('h3', { text: 'Exceções de alerta' }),
        h('p', { class: 'sutil pequeno', text: '"Não incluir" não muda nada; "Desligado" desativa esse tipo de alerta nos dispositivos do alvo; "Personalizado" define um limite próprio.' }),
        h('div', { class: 'grade-2' }, blocosOverride.map((b) => b.el)),
        h('h3', { text: 'Agendamentos' }),
        h('p', { class: 'sutil pequeno', text: 'Rodam nos dispositivos do alvo escolhido ao aplicar a política, com o nome prefixado por "[nome da política]".' }),
        areaAgendamentos,
        botao('Adicionar molde de agendamento', { icone: 'mais', tamanho: 'pequeno', onclick: () => adicionarMolde(null) }),
        h('div', { class: 'linha-entre mt-3' }, h('span', { class: 'sutil pequeno' }, 'Pede confirmação 2FA · fica na auditoria'), salvar),
      ];
    },
  });
}
