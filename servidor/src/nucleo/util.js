// Utilitários do núcleo.

export const MAX_SAIDA = 64 * 1024;

/** Corta um texto em `limite` bytes UTF-8, sem quebrar caractere, e avisa que truncou. */
export function truncar(texto, limite = MAX_SAIDA) {
  const s = String(texto ?? '');
  const buf = Buffer.from(s, 'utf8');
  if (buf.length <= limite) return s;
  return buf.subarray(0, limite).toString('utf8').replace(/�$/, '') + `\n[... saída truncada em ${Math.round(limite / 1024)} KB]`;
}

/** Erro HTTP para lançar de dentro de handlers: throw erroHttp(404, 'Não encontrado'). */
export function erroHttp(statusCode, mensagem, extra = {}) {
  const e = new Error(mensagem);
  e.statusCode = statusCode;
  Object.assign(e, { extra });
  return e;
}

export const ID_AGENTE = { type: 'string', pattern: '^[0-9a-f-]{36}$' };
export const PARAMS_ID = { type: 'object', required: ['id'], properties: { id: { type: 'integer', minimum: 1 } } };
export const PARAMS_AGENTE = { type: 'object', required: ['id'], properties: { id: ID_AGENTE } };

/** Esquema JSON de um alvo { tipo, id }. */
export const ALVO_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['tipo'],
  properties: {
    tipo: { type: 'string', pattern: '^[a-z][a-z0-9-]*$', maxLength: 32 },
    id: { type: ['string', 'integer', 'array'], maxLength: 64, maxItems: 1000, items: ID_AGENTE },
  },
};

/**
 * Filtro de escopo cliente/site para consultas sobre agentes.
 * @param {{cliente?: number, site?: number}} q   normalmente req.query
 * @param {string} alias  alias da tabela agentes na consulta
 * @returns {{ sql: string, args: any[] }}  sql começa com " AND ..." (ou é vazio)
 */
export function filtroEscopo(q = {}, alias = 'a') {
  if (q.site) return { sql: ` AND ${alias}.site_id = ?`, args: [Number(q.site)] };
  if (q.cliente) return { sql: ` AND ${alias}.site_id IN (SELECT id FROM sites WHERE cliente_id = ?)`, args: [Number(q.cliente)] };
  return { sql: '', args: [] };
}

/** Propriedades de querystring do escopo, para JSON Schema. */
export const ESCOPO_QUERY = { cliente: { type: 'integer', minimum: 1 }, site: { type: 'integer', minimum: 1 } };

/** Escapa curingas de LIKE. Use com ESCAPE '\\'. */
export function like(texto) {
  return `%${String(texto).replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}
