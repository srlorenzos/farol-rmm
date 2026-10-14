// Formulário gerado a partir das variáveis declaradas num script (biblioteca ou editor).
// Os valores vão para o servidor e chegam ao agente como FAROL_<NOME> — nunca interpolados no script.
import { h } from '../nucleo/dom.js';
import { campo, select } from './componentes.js';

/**
 * formularioVariaveis([{ nome, rotulo, tipo, padrao, obrigatorio, opcoes }])
 * → { el, valores(): {NOME: valor}, validar(): boolean }
 */
export function formularioVariaveis(defs = []) {
  const controles = new Map();
  const campos = defs.map((d) => {
    let c;
    if (d.tipo === 'booleano') {
      c = h('input', { type: 'checkbox', class: 'check', checked: d.padrao === true || d.padrao === 'true' });
      const el = h('div', { class: 'campo' }, h('label', { class: 'rotulo-check' }, c, d.rotulo));
      el.definirErro = () => {};
      controles.set(d.nome, { d, c, el });
      return el;
    }
    if (d.tipo === 'selecao') c = select([['', 'Escolha…'], ...d.opcoes.map((o) => [o, o])], d.padrao ?? '');
    else c = h('input', {
      class: ['input', d.tipo === 'numero' && 'input-mono'], type: d.tipo === 'senha' ? 'password' : d.tipo === 'numero' ? 'number' : 'text',
      value: d.padrao != null && d.tipo !== 'senha' ? String(d.padrao) : null, autocomplete: d.tipo === 'senha' ? 'new-password' : 'off',
      step: d.tipo === 'numero' ? 'any' : null, required: d.obrigatorio || null,
    });
    const el = campo(d.rotulo, c, { obrigatorio: d.obrigatorio, ajuda: `FAROL_${d.nome}${d.padrao != null && d.tipo !== 'senha' ? ` · padrão: ${d.padrao}` : ''}` });
    controles.set(d.nome, { d, c, el });
    return el;
  });
  return {
    el: h('div', { class: 'form' }, campos),
    valores() {
      const v = {};
      for (const [nome, { d, c }] of controles) {
        if (d.tipo === 'booleano') v[nome] = c.checked;
        else if (c.value !== '') v[nome] = d.tipo === 'numero' ? Number(c.value) : c.value;
      }
      return v;
    },
    validar() {
      let ok = true;
      for (const { d, c, el } of controles.values()) {
        const vazio = d.tipo !== 'booleano' && c.value.trim() === '' && d.padrao == null;
        const msg = d.obrigatorio && vazio ? 'Campo obrigatório' : d.tipo === 'numero' && c.value !== '' && !Number.isFinite(Number(c.value)) ? 'Informe um número' : '';
        el.definirErro(msg);
        if (msg && ok) { c.focus(); ok = false; }
      }
      return ok;
    },
  };
}
