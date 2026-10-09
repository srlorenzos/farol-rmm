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

export async function api(caminho, { metodo = 'GET', corpo, silencioso401 = false } = {}) {
  const opcoes = { method: metodo, headers: {}, credentials: 'same-origin' };
  if (metodo !== 'GET') opcoes.headers['X-Farol'] = '1';
  if (corpo !== undefined) {
    opcoes.headers['Content-Type'] = 'application/json';
    opcoes.body = JSON.stringify(corpo);
  }
  let r;
  try {
    r = await fetch(caminho, opcoes);
  } catch {
    throw new ErroApi(0, { erro: 'Sem conexão com o servidor' });
  }
  let dados = null;
  try { dados = await r.json(); } catch { /* corpo vazio */ }
  if (!r.ok) {
    if (r.status === 401 && !silencioso401 && !caminho.startsWith('/api/login') && !caminho.startsWith('/api/elevar')) {
      aoNaoAutenticado();
    }
    throw new ErroApi(r.status, dados);
  }
  return dados;
}

export const get = (c) => api(c);
export const post = (c, corpo = {}) => api(c, { metodo: 'POST', corpo });
export const put = (c, corpo) => api(c, { metodo: 'PUT', corpo });
export const del = (c) => api(c, { metodo: 'DELETE' });
