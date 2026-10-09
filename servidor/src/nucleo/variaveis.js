// Variáveis de script. Cada script pode declarar variáveis (formulário no painel). Na execução os valores
// viram variáveis de ambiente FAROL_<NOME> no agente — NUNCA são interpoladas no texto do script.

export const TIPOS_VARIAVEL = ['texto', 'numero', 'booleano', 'selecao', 'senha'];
export const NOME_VARIAVEL = /^[A-Z][A-Z0-9_]{0,47}$/;
const MAX_VALOR = 4000;

export class ErroVariavel extends Error {
  constructor(msg) { super(msg); this.statusCode = 400; }
}

/** Normaliza e valida a declaração de variáveis (vinda da biblioteca ou do editor). Lança Error com mensagem clara. */
export function normalizarDefinicoes(lista) {
  if (lista == null) return [];
  if (!Array.isArray(lista)) throw new ErroVariavel('variaveis deve ser uma lista');
  const vistos = new Set();
  return lista.map((v, i) => {
    if (!v || typeof v !== 'object') throw new ErroVariavel(`variável #${i + 1} inválida`);
    const nome = String(v.nome ?? '');
    if (!NOME_VARIAVEL.test(nome)) throw new ErroVariavel(`variável "${nome}": use MAIÚSCULAS, números e _ (ex.: DIAS)`);
    if (vistos.has(nome)) throw new ErroVariavel(`variável "${nome}" repetida`);
    vistos.add(nome);
    const tipo = v.tipo ?? 'texto';
    if (!TIPOS_VARIAVEL.includes(tipo)) throw new ErroVariavel(`variável "${nome}": tipo "${tipo}" inválido (${TIPOS_VARIAVEL.join(', ')})`);
    const opcoes = Array.isArray(v.opcoes) ? v.opcoes.map(String) : [];
    if (tipo === 'selecao' && !opcoes.length) throw new ErroVariavel(`variável "${nome}": seleção precisa de opcoes`);
    const def = {
      nome, tipo,
      rotulo: String(v.rotulo ?? nome).slice(0, 200),
      padrao: v.padrao === '' ? null : (v.padrao ?? null),
      obrigatorio: v.obrigatorio === true,
      opcoes,
    };
    if (def.padrao != null) converter(def, def.padrao); // o padrão também precisa ser válido
    if (tipo === 'senha') def.padrao = null; // senha nunca tem valor padrão guardado
    return def;
  });
}

function converter(def, valor) {
  switch (def.tipo) {
    case 'numero': {
      const n = typeof valor === 'number' ? valor : Number(String(valor).replace(',', '.'));
      if (!Number.isFinite(n) || String(valor).trim() === '') throw new ErroVariavel(`${def.rotulo}: informe um número`);
      return String(n);
    }
    case 'booleano':
      if (valor === true || valor === 'true' || valor === 1 || valor === '1') return 'true';
      if (valor === false || valor === 'false' || valor === 0 || valor === '0') return 'false';
      throw new ErroVariavel(`${def.rotulo}: valor deve ser verdadeiro ou falso`);
    case 'selecao':
      if (!def.opcoes.includes(String(valor))) throw new ErroVariavel(`${def.rotulo}: escolha uma das opções (${def.opcoes.join(', ')})`);
      return String(valor);
    default: {
      const s = String(valor);
      if (s.length > MAX_VALOR) throw new ErroVariavel(`${def.rotulo}: valor longo demais (máx. ${MAX_VALOR})`);
      if (s.includes('\0')) throw new ErroVariavel(`${def.rotulo}: caractere inválido`);
      return s;
    }
  }
}

/**
 * Valida os valores informados contra as definições e devolve o ambiente { FAROL_NOME: 'valor' }.
 * Valores ausentes usam o padrão; obrigatórios sem valor geram erro; chaves desconhecidas também.
 */
export function montarAmbiente(definicoes, valores = {}) {
  const defs = definicoes ?? [];
  const porNome = new Map(defs.map((d) => [d.nome, d]));
  for (const k of Object.keys(valores ?? {})) {
    if (!porNome.has(k)) throw new ErroVariavel(`Variável desconhecida: ${k}`);
  }
  const env = {};
  for (const d of defs) {
    let v = valores?.[d.nome];
    if (v === undefined || v === null || v === '') v = d.padrao;
    if (v === undefined || v === null || v === '') {
      if (d.obrigatorio) throw new ErroVariavel(`${d.rotulo}: campo obrigatório`);
      if (d.tipo === 'booleano') v = false;
      else continue;
    }
    env[`FAROL_${d.nome}`] = converter(d, v);
  }
  return env;
}

/** Cópia do ambiente para auditoria, com valores de senha mascarados. */
export function ambienteParaAuditoria(definicoes, env) {
  const senhas = new Set((definicoes ?? []).filter((d) => d.tipo === 'senha').map((d) => `FAROL_${d.nome}`));
  return Object.fromEntries(Object.entries(env).map(([k, v]) => [k, senhas.has(k) ? '••••' : v.slice(0, 200)]));
}
