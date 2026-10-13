// Utilitários HTTP das funções: respostas, corpo JSON/raw, IP e limite de requisições por IP (em memória, por instância).
const MAX_JSON = 20 * 1024;

export function responder(res, status, corpo, cabecalhos = {}) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  for (const [k, v] of Object.entries(cabecalhos)) res.setHeader(k, v);
  res.end(JSON.stringify(corpo));
}

export async function lerRaw(req, limite = 1024 * 1024) {
  if (Buffer.isBuffer(req.rawBody)) return req.rawBody;
  const partes = [];
  let total = 0;
  for await (const c of req) {
    total += c.length;
    if (total > limite) throw Object.assign(new Error('Corpo grande demais'), { status: 413 });
    partes.push(c);
  }
  return Buffer.concat(partes);
}

export async function lerJson(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
  const bruto = typeof req.body === 'string' ? Buffer.from(req.body) : await lerRaw(req, MAX_JSON);
  if (bruto.length > MAX_JSON) throw Object.assign(new Error('Corpo grande demais'), { status: 413 });
  try {
    const j = JSON.parse(bruto.toString('utf8') || '{}');
    if (j && typeof j === 'object' && !Array.isArray(j)) return j;
  } catch { /* cai no erro abaixo */ }
  throw Object.assign(new Error('JSON inválido'), { status: 400 });
}

export function ipDe(req) {
  const xf = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return xf || String(req.headers['x-real-ip'] || '') || req.socket?.remoteAddress || 'desconhecido';
}

const baldes = new Map();
/** Janela deslizante simples. Devolve true se passou do limite. Melhor esforço (cada instância tem sua memória). */
export function excedeu(req, nome, max, janelaMs) {
  const agora = Date.now();
  const chave = `${nome}:${ipDe(req)}`;
  const lista = (baldes.get(chave) ?? []).filter((t) => agora - t < janelaMs);
  lista.push(agora);
  baldes.set(chave, lista);
  if (baldes.size > 5000) for (const [k, v] of baldes) if (!v.some((t) => agora - t < janelaMs)) baldes.delete(k);
  return lista.length > max;
}

export function exigirMetodo(req, res, metodo) {
  if (req.method === metodo) return true;
  responder(res, 405, { erro: 'Método não permitido' }, { Allow: metodo });
  return false;
}

export function urlBase(req) {
  const env = (process.env.SITE_URL || '').replace(/\/+$/, '');
  if (/^https?:\/\/[a-z0-9.:-]+$/i.test(env)) return env;
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '');
  if (!/^[a-z0-9.-]+(:\d+)?$/i.test(host)) return 'https://farol-rmm.vercel.app';
  const proto = host.startsWith('localhost') || host.startsWith('127.') ? 'http' : 'https';
  return `${proto}://${host}`;
}
