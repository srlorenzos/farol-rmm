// Componentes básicos do design system. Use SEMPRE estes (catálogo em #/estilo, documentação em painel/DESIGN.md).
import { h, s, preencher, uid } from '../nucleo/dom.js';
import { icone } from '../nucleo/icones.js';
import { fmtPct } from '../nucleo/formato.js';
import { ilustracao } from './ilustracoes.js';

// ------------------------------------------------------------------ botões
/**
 * botao('Salvar', { variante: 'primario'|'secundario'|'fantasma'|'perigo'|'perigo-sutil', icone, tamanho: 'pequeno'|'grande',
 *   onclick, tipo: 'button'|'submit', href, desabilitado, dica, emBreve })
 */
export function botao(rotulo, o = {}) {
  const classes = ['btn', o.variante && o.variante !== 'secundario' && `btn-${o.variante}`, o.tamanho && `btn-${o.tamanho}`, o.classe];
  const filhos = [o.icone ? icone(o.icone) : null, rotulo ? h('span', { text: rotulo }) : null,
    o.emBreve ? h('span', { class: 'btn-selo', text: 'em breve' }) : null];
  const attrs = { class: classes, 'data-dica': o.dica ?? (o.emBreve ? 'Disponível em breve' : null), 'aria-label': o.rotuloAria ?? null };
  if (o.href) return h('a', { ...attrs, href: o.href, 'aria-disabled': o.desabilitado ? 'true' : null }, filhos);
  return h('button', { ...attrs, type: o.tipo ?? 'button', onclick: o.onclick, disabled: o.desabilitado || o.emBreve }, filhos);
}

/** Botão só com ícone (rótulo vira aria-label e dica). */
export function botaoIcone(nomeIcone, rotulo, o = {}) {
  const attrs = { class: ['btn-icone', o.pequeno && 'pequeno', o.classe], 'aria-label': rotulo, 'data-dica': o.semDica ? null : rotulo };
  if (o.href) return h('a', { ...attrs, href: o.href }, icone(nomeIcone));
  return h('button', { ...attrs, type: 'button', onclick: o.onclick, disabled: o.desabilitado }, icone(nomeIcone), o.contador ?? null);
}

/** Liga/desliga o estado "carregando" de um botão enquanto a promessa roda. */
export async function comCarregando(btn, fn) {
  btn.classList.add('carregando');
  btn.disabled = true;
  try { return await fn(); } finally { btn.classList.remove('carregando'); btn.disabled = false; }
}

// ------------------------------------------------------------------ formulários
/** campo('Nome', input, { ajuda, obrigatorio, erro }) — liga label↔input pelo id. */
export function campo(rotulo, controle, o = {}) {
  const id = controle.id || uid('campo');
  controle.id = id;
  const erro = h('p', { class: 'erro-campo', role: 'alert', id: `${id}-erro` });
  if (o.ajuda) controle.setAttribute('aria-describedby', `${id}-ajuda`);
  const el = h('div', { class: ['campo', o.classe] },
    h('label', { class: 'rotulo', for: id }, rotulo, o.obrigatorio ? h('span', { class: 'obrigatorio', 'aria-hidden': 'true', text: '*' }) : null),
    controle,
    o.ajuda ? h('p', { class: 'ajuda', id: `${id}-ajuda`, text: o.ajuda }) : null,
    erro);
  el.definirErro = (msg) => { erro.textContent = msg || ''; controle.setAttribute('aria-invalid', msg ? 'true' : 'false'); };
  return el;
}

export const input = (o = {}) => h('input', { class: ['input', o.classe], type: o.tipo ?? 'text', ...o.attrs, value: o.valor ?? null, placeholder: o.placeholder ?? null });
export function select(opcoes, valor, o = {}) {
  const el = h('select', { class: ['input', 'select', o.classe], 'aria-label': o.rotulo ?? null, ...o.attrs },
    opcoes.map(([v, t]) => h('option', { value: v }, t)));
  if (valor != null) el.value = String(valor);
  return el;
}
export const textarea = (o = {}) => h('textarea', { class: ['input', o.classe], rows: o.linhas ?? 4, ...o.attrs, placeholder: o.placeholder ?? null, value: o.valor ?? null });

export function busca(placeholder, o = {}) {
  const el = h('input', { class: 'input', type: 'search', placeholder, 'aria-label': o.rotulo ?? placeholder, value: o.valor ?? null, autocomplete: 'off' });
  return { el: h('label', { class: ['busca', o.classe] }, icone('busca'), el), input: el };
}

export function check(rotulo, o = {}) {
  const c = h('input', { type: 'checkbox', class: 'check', checked: o.marcado, 'aria-label': o.somenteAria ? rotulo : null, onchange: o.onchange });
  if (o.somenteAria) return c;
  return { el: h('label', { class: 'rotulo-check' }, c, rotulo), input: c };
}

export function interruptor(rotulo, o = {}) {
  const c = h('input', { type: 'checkbox', role: 'switch', checked: o.marcado, onchange: o.onchange });
  return { el: h('label', { class: 'interruptor' }, c, h('span', { class: 'interruptor-trilho', 'aria-hidden': 'true' }), rotulo), input: c };
}

/** Controle segmentado: segmentado([['1','1 h'],['24','24 h']], '24', (v) => ...) */
export function segmentado(opcoes, valor, aoMudar, rotulo = 'Opções') {
  const el = h('div', { class: 'segmentado', role: 'group', 'aria-label': rotulo });
  const desenhar = () => preencher(el, opcoes.map(([v, t]) => h('button', {
    class: 'segmento', type: 'button', 'aria-pressed': String(String(v) === String(valor)),
    onclick: () => { valor = v; desenhar(); aoMudar(v); },
  }, t)));
  desenhar();
  return el;
}

export function campoCodigo(id = uid('codigo')) {
  const el = h('input', {
    id, class: 'input input-codigo', inputmode: 'numeric', autocomplete: 'one-time-code', pattern: '[0-9]{6}',
    maxlength: 6, required: true, placeholder: '000000', 'aria-label': 'Código de 6 dígitos do autenticador',
  });
  el.addEventListener('input', () => { el.value = el.value.replace(/\D/g, '').slice(0, 6); });
  return el;
}

// ------------------------------------------------------------------ estados e selos
/** selo('Texto', 'ok'|'aviso'|'critico'|'info'|'marca'|'neutro', { icone }) */
export const selo = (texto, tom = 'neutro', o = {}) => h('span', { class: ['selo', tom !== 'neutro' && `selo-${tom}`, o.classe], title: o.dica ?? null },
  o.icone ? icone(o.icone) : null, texto);

const ROTULOS_STATUS = { online: 'Online', offline: 'Offline', pendente: 'Aguardando', revogado: 'Revogado' };
/** Estado de dispositivo: ponto colorido (pulsante se online) + texto. Cor nunca é o único sinal. */
export const estadoDispositivo = (status) => h('span', { class: `estado estado-${status}` },
  h('span', { class: 'ponto-estado', 'aria-hidden': 'true' }), ROTULOS_STATUS[status] ?? status);

const SEVERIDADES = { critico: ['Crítico', 'critico'], alerta: ['Alerta', 'aviso'], info: ['Info', 'info'] };
export const severidade = (sev) => {
  const [rotulo, ic] = SEVERIDADES[sev] ?? [sev, 'info'];
  return h('span', { class: `severidade severidade-${sev}` }, icone(ic), rotulo);
};

const ROTULOS_JOB = {
  pendente: ['Na fila', 'neutro', 'relogio'], enviado: ['Executando', 'info', 'play'], sucesso: ['Sucesso', 'ok', 'check'],
  falha: ['Falha', 'critico', 'fechar'], timeout: ['Tempo esgotado', 'aviso', 'relogio'], expirado: ['Sem resposta', 'aviso', 'aviso'],
  cancelado: ['Cancelado', 'neutro', 'revogar'],
};
export const statusJob = (status) => {
  const [t, tom, ic] = ROTULOS_JOB[status] ?? [status, 'neutro', 'info'];
  return selo(t, tom, { icone: ic });
};

export function nivel(pct) {
  if (pct == null) return 'vazio';
  if (pct >= 90) return 'critico';
  if (pct >= 75) return 'alerta';
  return 'ok';
}

/** Medidor (mini barra) com valor em texto. medidor(72, 'CPU', { rotulo: true, grande: false }) */
export function medidor(pct, nome, o = {}) {
  const valor = h('span', { class: `medidor-valor nivel-${nivel(pct)}` });
  valor.style.width = `${Math.max(0, Math.min(100, pct ?? 0))}%`;
  return h('span', { class: ['medidor', o.grande && 'grande', pct == null && 'medidor-vazio'], title: `${nome}: ${fmtPct(pct)}` },
    o.rotulo ? h('span', { class: 'medidor-rotulo', text: nome }) : null,
    h('span', { class: 'medidor-trilho', role: 'meter', 'aria-label': nome, 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': Math.round(pct ?? 0) }, valor),
    o.semTexto ? null : h('span', { class: 'medidor-texto', text: fmtPct(pct) }));
}

// ------------------------------------------------------------------ estrutura
/**
 * Cabeçalho de página: cabecalhoPagina({ titulo, subtitulo, migalhas: [['Dispositivos', '#/dispositivos'], ['pc-01']], acoes: [nós] })
 */
export function cabecalhoPagina({ titulo, subtitulo, migalhas, acoes }) {
  return h('header', { class: 'pagina-cabecalho' },
    h('div', { class: 'titulo-bloco' },
      migalhas?.length ? migalhasEl(migalhas) : null,
      h('h1', { text: titulo }),
      subtitulo ? h('p', { text: subtitulo }) : null),
    acoes?.length ? h('div', { class: 'pagina-acoes' }, acoes) : null);
}

export function migalhasEl(itens) {
  return h('nav', { class: 'migalhas', 'aria-label': 'Você está em' }, itens.map(([t, href], i) => [
    i ? icone('chevron', { tamanho: 12 }) : null,
    href ? h('a', { href, text: t }) : h('span', { 'aria-current': 'page', text: t }),
  ]));
}

/** cartao({ titulo, sub, acoes, corpo, semPadding, classe }) */
export function cartao({ titulo, sub, acoes, corpo, semPadding, classe, rodape } = {}) {
  return h('section', { class: ['cartao', classe] },
    titulo ? h('header', { class: 'cartao-cabecalho' },
      h('div', {}, h('h2', { text: titulo }), sub ? h('div', { class: 'sub', text: sub }) : null),
      acoes ? h('div', { class: 'linha' }, acoes) : null) : null,
    h('div', { class: ['cartao-corpo', semPadding && 'sem-padding'] }, corpo),
    rodape ? h('footer', { class: 'cartao-rodape' }, rodape) : null);
}

/** Bloco de estatística: estatistica({ rotulo, valor, detalhe, icone, href, tom }) */
export function estatistica({ rotulo, valor, detalhe, icone: ic, href, tom }) {
  const corpo = [
    h('span', { class: 'estatistica-rotulo' }, tom ? h('span', { class: `ponto-estado ${tom}`, 'aria-hidden': 'true' }) : (ic ? icone(ic) : null), rotulo),
    h('span', { class: 'estatistica-valor', text: valor }),
    detalhe ? h('span', { class: 'estatistica-detalhe', text: detalhe }) : null,
  ];
  return href ? h('a', { class: 'cartao estatistica', href }, corpo) : h('div', { class: 'cartao estatistica' }, corpo);
}

/**
 * Abas acessíveis (setas do teclado). abas([{ id, rotulo, contagem? }], ativa, (id) => ...)
 */
export function abas(itens, ativa, aoMudar, rotulo = 'Seções') {
  const el = h('div', { class: 'abas', role: 'tablist', 'aria-label': rotulo });
  const desenhar = () => {
    preencher(el, itens.map((a) => h('button', {
      class: 'aba', role: 'tab', type: 'button', id: `aba-${a.id}`, 'aria-selected': String(a.id === ativa), tabindex: a.id === ativa ? 0 : -1,
      onclick: () => { ativa = a.id; desenhar(); aoMudar(a.id); },
    }, a.icone ? icone(a.icone) : null, a.rotulo, a.contagem != null ? h('span', { class: 'aba-n', text: a.contagem }) : null)));
  };
  el.addEventListener('keydown', (ev) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(ev.key)) return;
    ev.preventDefault();
    const i = itens.findIndex((a) => a.id === ativa);
    const n = ev.key === 'Home' ? 0 : ev.key === 'End' ? itens.length - 1 : (i + (ev.key === 'ArrowRight' ? 1 : -1) + itens.length) % itens.length;
    ativa = itens[n].id;
    desenhar();
    el.querySelector('[aria-selected="true"]')?.focus();
    aoMudar(ativa);
  });
  desenhar();
  el.definir = (id) => { ativa = id; desenhar(); };
  return el;
}

/** Chips de filtro (toggle): chips([{ id, rotulo, n?, icone? }], selecionado, (id) => ..., { multiplo }) */
export function chipsFiltro(itens, selecionados, aoMudar, { multiplo = false, rotulo = 'Filtros rápidos' } = {}) {
  let sel = new Set([].concat(selecionados ?? []).filter((x) => x != null && x !== ''));
  const el = h('div', { class: 'chips', role: 'group', 'aria-label': rotulo });
  const desenhar = () => preencher(el, itens.map((c) => h('button', {
    class: 'chip', type: 'button', 'aria-pressed': String(sel.has(c.id)),
    onclick: () => {
      if (multiplo) { sel.has(c.id) ? sel.delete(c.id) : sel.add(c.id); } else { sel = sel.has(c.id) ? new Set() : new Set([c.id]); }
      desenhar();
      aoMudar(multiplo ? [...sel] : [...sel][0] ?? '');
    },
  }, c.icone ? icone(c.icone) : null, c.ponto ? h('span', { class: `ponto-estado ${c.ponto}`, 'aria-hidden': 'true' }) : null, c.rotulo,
  c.n != null ? h('span', { class: 'chip-n', text: c.n }) : null)));
  desenhar();
  el.atualizar = (novos) => { itens = novos; desenhar(); };
  return el;
}

export function skeleton(linhas = 4, o = {}) {
  return h('div', { class: 'skeleton-grupo', 'aria-busy': 'true', 'aria-label': 'Carregando' },
    Array.from({ length: linhas }, (_, i) => {
      const l = h('div', { class: ['skeleton', o.alto && 'alto'] });
      l.style.width = `${100 - ((i * 17) % 38)}%`;
      return l;
    }));
}

/** Estado vazio ilustrado: vazio({ titulo, texto, acoes, ilustracao: 'farol'|'busca'|'tudo-ok'|'caixa'|'erro', compacto }) */
export function vazio({ titulo, texto, acoes, ilustracao: il = 'farol', compacto } = {}) {
  return h('div', { class: ['vazio', compacto && 'compacto'] }, ilustracao(il),
    h('p', { class: 'vazio-titulo', text: titulo }), texto ? h('p', { text: texto }) : null,
    acoes?.length ? h('div', { class: 'grupo-botoes' }, acoes) : null);
}

/** aviso('texto', 'info'|'ok'|'alerta'|'critico') */
export const aviso = (conteudo, tom = 'info') => h('div', { class: `aviso aviso-${tom}`, role: tom === 'critico' ? 'alert' : null },
  icone({ info: 'info', ok: 'ok', alerta: 'aviso', critico: 'critico' }[tom]), h('div', {}, conteudo));

/** Lista de definição: listaDef([['Fabricante', 'Dell'], ...]) */
export const listaDef = (pares) => h('dl', { class: 'lista-def' }, pares.map(([k, v]) => [h('dt', { text: k }),
  h('dd', {}, v == null || v === '' ? '—' : v)]));

export const fatos = (pares) => h('dl', { class: 'fatos' }, pares.map(([k, v]) => h('div', { class: 'fato' }, h('dt', { text: k }), h('dd', {}, v ?? '—'))));

export function blocoMono(texto, o = {}) {
  return h('pre', { class: ['bloco-mono', o.erro && 'erro', o.classe], tabindex: 0 }, h('code', { text: texto }));
}

export function botaoCopiar(texto, rotulo = 'Copiar', { toast } = {}) {
  const b = botao('Copiar', { icone: 'copiar', tamanho: 'pequeno', rotuloAria: rotulo });
  b.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(typeof texto === 'function' ? texto() : texto);
      preencher(b, icone('check'), h('span', { text: 'Copiado' }));
      setTimeout(() => preencher(b, icone('copiar'), h('span', { text: 'Copiar' })), 1600);
    } catch {
      toast?.('Não foi possível copiar. Selecione o texto manualmente.', 'erro');
    }
  });
  return b;
}

export const kbd = (t) => h('kbd', { text: t });

/** Pequeno sparkline SVG (tendência, sem eixo): sparkline([1,3,2], { largura, altura }) */
export function sparkline(valores, { largura = 96, altura = 28 } = {}) {
  const v = valores.filter((x) => x != null);
  const svg = s('svg', { viewBox: `0 0 ${largura} ${altura}`, width: largura, height: altura, 'aria-hidden': 'true', class: 'grafico' });
  if (v.length < 2) return svg;
  const max = Math.max(...v, 1);
  const pts = v.map((x, i) => `${(i / (v.length - 1)) * (largura - 4) + 2},${altura - 2 - (x / max) * (altura - 4)}`);
  svg.append(s('polyline', { points: pts.join(' '), class: 'serie-linha', 'stroke-width': 1.5 }));
  return svg;
}
