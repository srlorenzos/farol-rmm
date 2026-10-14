// Cliente HTTP do painel. Toda mutação leva o header anti-CSRF X-Farol.

export class ErroApi extends Error {
  constructor(status, dados) {
    super(dados?.erro || `Erro ${status}`);
    this.status = status;
    this.dados = dados || {};
  }
}

let aoNaoAutenticado = () => {};
export function definirAoNaoAutenticado(fn) { aoNaoAutenticado = fn; }

export async function api(caminho, { metodo = 'GET', corpo, sinal } = {}) {
  const opcoes = { method: metodo, headers: {}, credentials: 'same-origin', signal: sinal };
  if (metodo !== 'GET') opcoes.headers['X-Farol'] = '1';
  if (corpo !== undefined) {
    opcoes.headers['Content-Type'] = 'application/json';
    opcoes.body = JSON.stringify(corpo);
  }
  let r;
  try {
    r = await fetch(caminho, opcoes);
  } catch (e) {
    if (e.name === 'AbortError') throw e;
    throw new ErroApi(0, { erro: 'Sem conexão com o servidor' });
  }
  let dados = null;
  try { dados = await r.json(); } catch { /* corpo vazio */ }
  if (!r.ok) {
    if (r.status === 401 && !/^\/api\/(login|elevar|setup)/.test(caminho)) aoNaoAutenticado();
    throw new ErroApi(r.status, dados);
  }
  return dados;
}

export const get = (c, o) => api(c, o);
export const post = (c, corpo = {}) => api(c, { metodo: 'POST', corpo });
export const put = (c, corpo) => api(c, { metodo: 'PUT', corpo });
export const del = (c) => api(c, { metodo: 'DELETE' });

/** Monta querystring ignorando valores vazios: qs({ a: 1, b: '' }) → '?a=1' */
export function qs(params) {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params ?? {})) if (v != null && v !== '') u.set(k, v);
  const t = u.toString();
  return t ? `?${t}` : '';
}
