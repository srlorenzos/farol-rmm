// Abas do detalhe do dispositivo registradas por este módulo.
import { h, preencher, debounce } from '../../nucleo/dom.js';
import { get, put } from '../../nucleo/api.js';
import { pode } from '../../nucleo/estado.js';
import { fmtBytes, fmtDuracao, fmtData, fmtPct, relativo, ramPct, normalizar, fmtInt } from '../../nucleo/formato.js';
import { cartao, listaDef, medidor, vazio, skeleton, segmentado, busca, selo, botao, textarea, fatos } from '../../ui/componentes.js';
import { graficoLinha } from '../../ui/graficos.js';
import { tabelaVirtual } from '../../ui/tabela-virtual.js';
import { toast, toastErro } from '../../ui/camadas.js';
import { nomeSo } from './comum.js';

// ------------------------------------------------------------------ Resumo
export function abaResumo(el, { agente: a }) {
  const inv = a.inventario ?? {};
  const hw = inv.hardware ?? {};
  const discos = a.discos ?? [];
  const ativas = (inv.rede ?? []).filter((n) => n.ativa && n.ipv4?.length);

  const saude = cartao({
    titulo: 'Saúde agora', sub: `Atualizado ${relativo(a.ultimo_checkin)}`,
    corpo: h('div', { class: 'pilha' },
      linhaMetrica('CPU', a.cpu_pct, hw.cpu_modelo ? `${hw.nucleos_logicos ?? '?'} núcleos lógicos` : null),
      linhaMetrica('Memória', ramPct(a), a.ram_total ? `${fmtBytes(a.ram_usada)} de ${fmtBytes(a.ram_total)}` : null),
      linhaMetrica('Disco (maior uso)', a.disco_max_pct, discos.length ? `${discos.length} volume(s)` : null)),
  });

  const sistema = cartao({
    titulo: 'Sistema',
    corpo: listaDef([
      ['Sistema operacional', nomeSo(a)], ['Arquitetura', a.arquitetura], ['Fabricante', hw.fabricante], ['Modelo', hw.modelo],
      ['Número de série', hw.serial], ['Processador', hw.cpu_modelo], ['Memória total', a.ram_total ? fmtBytes(a.ram_total) : null],
      ['Inicializado', inv.sistema?.boot ? fmtData(inv.sistema.boot * 1000) : null],
    ]),
  });

  const agenteCartao = cartao({
    titulo: 'Agente',
    corpo: listaDef([
      ['Versão', a.versao_agente ? `v${a.versao_agente}` : null],
      ['Canal em tempo real', a.tempo_real ? selo('Conectado', 'ok', { icone: 'raio' }) : selo('Só check-in', 'neutro')],
      ['Registrado em', fmtData(a.registrado_em)], ['Último contato', fmtData(a.ultimo_checkin, { segundos: true })],
      ['Site', `${a.cliente_nome} · ${a.site_nome}`], ['Capacidades', (a.capacidades ?? []).length ? `${a.capacidades.length} comandos e sessões` : null],
      ['ID', h('code', { class: 'inline', text: a.id })],
    ]),
  });

  const discosCartao = cartao({
    titulo: 'Volumes',
    corpo: discos.length ? h('div', { class: 'pilha' }, discos.map((d) => h('div', { class: 'pilha-2' },
      h('div', { class: 'linha-entre pequeno' }, h('span', {}, h('strong', { class: 'mono', text: d.ponto }), h('span', { class: 'sutil', text: ` ${d.fs ?? ''}` })),
        h('span', { class: 'sutil tabular', text: `${fmtBytes(d.total - d.usado)} livres de ${fmtBytes(d.total)}` })),
      medidor(d.pct, `Uso de ${d.ponto}`, { grande: true }))))
      : vazio({ titulo: 'Sem dados de disco', compacto: true, ilustracao: 'caixa' }),
  });

  const redeCartao = cartao({
    titulo: 'Rede',
    corpo: listaDef([
      ['IP local', a.ip_local ? h('span', { class: 'mono', text: a.ip_local }) : null],
      ['Interfaces ativas', ativas.length ? ativas.map((n) => `${n.nome} (${n.ipv4.join(', ')})`).join(' · ') : null],
      ['Usuário logado', a.usuario_logado], ['Ligado há', a.uptime != null ? fmtDuracao(a.uptime) : null],
    ]),
  });

  const desc = textarea({ valor: a.descricao ?? '', linhas: 3, placeholder: 'Anotações sobre este dispositivo (local, responsável, observações)…', attrs: { maxlength: 500, 'aria-label': 'Descrição' } });
  const salvar = botao('Salvar', { tamanho: 'pequeno', onclick: async () => {
    try { await put(`/api/agentes/${a.id}`, { descricao: desc.value.trim() || null }); toast('Descrição salva.', 'sucesso'); } catch (e) { toastErro(e); }
  } });
  const notas = cartao({ titulo: 'Descrição', corpo: pode('dispositivos.editar') ? h('div', { class: 'pilha-2' }, desc, h('div', { class: 'linha' }, salvar)) : h('p', { class: 'muted', text: a.descricao || 'Sem descrição.' }) });

  el.append(h('div', { class: 'grade-widgets' },
    wrap(saude, 4), wrap(sistema, 4), wrap(agenteCartao, 4), wrap(discosCartao, 6), wrap(redeCartao, 6), wrap(notas, 12)));
}

const wrap = (n, t) => { n.dataset.tamanho = String(t); return n; };

function linhaMetrica(nome, pct, detalhe) {
  return h('div', { class: 'pilha-2' },
    h('div', { class: 'linha-entre' }, h('span', { class: 'pequeno muted', text: nome }), h('strong', { class: 'tabular', text: fmtPct(pct) })),
    medidor(pct, nome, { grande: true }),
    detalhe ? h('span', { class: 'pequeno sutil', text: detalhe }) : null);
}

// ------------------------------------------------------------------ Monitoramento
export function abaMonitoramento(el, { agente: a }) {
  let horas = 24;
  const graficos = h('div', { class: 'grade-widgets' });
  const desenhar = async () => {
    preencher(graficos, [1, 2, 3].map(() => wrap(cartao({ corpo: skeleton(7) }), 4)));
    try {
      const m = await get(`/api/agentes/${a.id}/metricas?horas=${horas}`);
      const ate = Date.now();
      const g = (titulo, campo, limite) => wrap(cartao({ corpo: graficoLinha({ titulo, pontos: m.pontos, campo, desde: m.desde, ate, baldeMs: m.baldeMs, limite }) }), 12);
      preencher(graficos, g('CPU', 'cpu', 90), g('Memória RAM', 'ram', 90), g('Disco (maior uso)', 'disco', 90));
    } catch (e) { toastErro(e); }
  };
  el.append(h('div', { class: 'linha-entre mb-4' },
    h('p', { class: 'muted pequeno', text: 'Histórico com um ponto por minuto, guardado por 7 dias. A linha vermelha marca o limite de alerta.' }),
    segmentado([[1, '1 h'], [24, '24 h'], [168, '7 dias']], horas, (v) => { horas = Number(v); desenhar(); }, 'Período')), graficos);
  desenhar();
}

// ------------------------------------------------------------------ Inventário
export function abaInventario(el, { agente: a }) {
  const inv = a.inventario;
  if (!inv) {
    el.append(vazio({ titulo: 'Inventário ainda não recebido', texto: 'O agente envia o inventário completo no primeiro check-in e depois a cada hora.', ilustracao: 'caixa' }));
    return;
  }
  const hw = inv.hardware ?? {};
  const so = inv.sistema ?? {};
  const rede = (inv.rede ?? []).slice().sort((x, y) => Number(y.ativa) - Number(x.ativa));
  el.append(
    h('p', { class: 'sutil pequeno mb-4', text: `Coletado ${relativo(a.inventario_em)} (${fmtData(a.inventario_em)})` }),
    fatos([['Fabricante', hw.fabricante], ['Modelo', hw.modelo], ['Série', hw.serial], ['Processador', hw.cpu_modelo],
      ['Núcleos', hw.nucleos_fisicos ? `${hw.nucleos_fisicos} físicos · ${hw.nucleos_logicos} lógicos` : hw.nucleos_logicos], ['Memória', fmtBytes(hw.ram_total)],
      ['Sistema', so.versao], ['Python do agente', so.python]]),
    h('div', { class: 'grade-widgets mt-4' },
      wrap(cartao({
        titulo: 'Interfaces de rede', sub: `${rede.length} interface(s)`, semPadding: true,
        corpo: h('div', { class: 'tabela-caixa' }, h('table', { class: 'tabela' },
          h('thead', {}, h('tr', {}, ['Interface', 'Estado', 'MAC', 'IPv4', 'IPv6', 'Velocidade'].map((t) => h('th', { scope: 'col' }, t)))),
          h('tbody', {}, rede.map((n) => h('tr', {},
            h('td', { text: n.nome }),
            h('td', {}, n.ativa ? selo('Ativa', 'ok') : selo('Inativa')),
            h('td', { class: 'mono', text: n.mac || '—' }),
            h('td', { class: 'mono', text: (n.ipv4 || []).join(', ') || '—' }),
            h('td', { class: 'mono quebra pequeno', text: (n.ipv6 || []).join(', ') || '—' }),
            h('td', { class: 'num', text: n.velocidade_mbps ? `${fmtInt(n.velocidade_mbps)} Mbps` : '—' })))))),
      }), 12),
      wrap(cartao({
        titulo: 'Partições', semPadding: true,
        corpo: h('div', { class: 'tabela-caixa' }, h('table', { class: 'tabela' },
          h('thead', {}, h('tr', {}, ['Dispositivo', 'Ponto de montagem', 'Sistema de arquivos'].map((t) => h('th', { scope: 'col' }, t)))),
          h('tbody', {}, (inv.discos ?? []).map((d) => h('tr', {}, h('td', { class: 'mono', text: d.dispositivo }), h('td', { class: 'mono', text: d.ponto }), h('td', { text: d.fs })))))),
      }), 12)));
}

// ------------------------------------------------------------------ Software
export function abaSoftware(el, { agente: a }) {
  const todos = a.inventario?.softwares ?? [];
  if (!todos.length) {
    el.append(vazio({ titulo: 'Nenhum software inventariado', texto: 'A lista vem do registro do Windows (ou dpkg/rpm no Linux) no próximo inventário.', ilustracao: 'caixa' }));
    return;
  }
  const campoBusca = busca('Buscar software ou fabricante…', { classe: 'cresce' });
  const contagem = h('span', { class: 'sutil pequeno' });
  const tabela = tabelaVirtual({
    rotulo: 'Softwares instalados', chave: (s) => `${s.nome}|${s.versao}`, ordem: { coluna: 'nome', direcao: 'asc' },
    colunas: [
      { id: 'nome', rotulo: 'Nome', largura: 'minmax(260px, 2fr)', render: (s) => h('span', { class: 'forte', text: s.nome }), valor: (s) => s.nome },
      { id: 'versao', rotulo: 'Versão', largura: 'minmax(120px, 1fr)', render: (s) => h('span', { class: 'mono pequeno', text: s.versao || '—' }), valor: (s) => s.versao },
      { id: 'fabricante', rotulo: 'Fabricante', largura: 'minmax(160px, 1.2fr)', render: (s) => h('span', { class: 'muted', text: s.fabricante || '—' }), valor: (s) => s.fabricante },
      { id: 'instalado', rotulo: 'Instalado em', largura: '130px', render: (s) => fmtInstalacao(s.instalado_em), valor: (s) => s.instalado_em },
    ],
    vazio: () => vazio({ titulo: 'Nenhum software corresponde à busca', ilustracao: 'busca', compacto: true }),
  });
  const aplicar = () => {
    const t = normalizar(campoBusca.input.value).split(/\s+/).filter(Boolean);
    const f = todos.filter((s) => { const alvo = normalizar(`${s.nome} ${s.fabricante ?? ''}`); return t.every((x) => alvo.includes(x)); });
    contagem.textContent = `${fmtInt(f.length)} de ${fmtInt(todos.length)}`;
    tabela.definirLinhas(f);
  };
  campoBusca.input.addEventListener('input', debounce(aplicar, 100));
  el.append(h('section', { class: 'cartao' }, h('div', { class: 'ferramentas' }, campoBusca.el, h('span', { class: 'espaco' }), contagem), tabela.el));
  aplicar();
}

function fmtInstalacao(v) {
  const m = /^(\d{4})(\d{2})(\d{2})$/.exec(String(v ?? ''));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : (v || '—');
}
