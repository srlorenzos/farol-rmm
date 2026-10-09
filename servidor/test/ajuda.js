// Utilitários de teste: app com banco em memória e cliente com cookie.
import { criarApp } from '../src/app.js';
import { carregarConfig } from '../src/config.js';
import { abrirBanco } from '../src/db.js';
import { criarUsuario } from '../src/rotas/auth.js';
import { totp, base32Decodificar } from '../src/seguranca.js';

export const SENHA = 'Senha-Forte-123';

export async function novoApp(sobrescrever = {}) {
  const db = abrirBanco(':memory:');
  const config = carregarConfig({ caminhoBanco: ':memory:', tarefasPeriodicas: false, webhookUrl: '', urlPublica: '', https: false, ...sobrescrever });
  const app = await criarApp({ config, db });
  return { app, db, ctx: app.farol };
}

/** Cliente que guarda o cookie de sessão e envia o header anti-CSRF. */
export function cliente(app) {
  let cookie = '';
  async function req(method, url, payload, { semCsrf = false, headers = {} } = {}) {
    const h = { ...headers };
    if (cookie) h.cookie = cookie;
    if (!semCsrf && method !== 'GET') h['x-farol'] = '1';
    const r = await app.inject({ method, url, payload, headers: h });
    const sc = r.headers['set-cookie'];
    if (sc) {
      const v = String(Array.isArray(sc) ? sc[0] : sc).split(';')[0];
      cookie = v.endsWith('=') ? '' : v;
    }
    let json = null;
    try { json = r.json(); } catch {}
    return { status: r.statusCode, json, headers: r.headers };
  }
  return {
    get: (u, o) => req('GET', u, undefined, o),
    post: (u, p, o) => req('POST', u, p ?? {}, o),
    put: (u, p, o) => req('PUT', u, p, o),
    del: (u, o) => req('DELETE', u, undefined, o),
    get cookie() { return cookie; },
  };
}

export function codigoAtual(segredo, deslocamentoPassos = 0) {
  return totp(base32Decodificar(segredo), { tempoMs: Date.now() + deslocamentoPassos * 30_000 });
}

/** Cria admin, faz login, ativa 2FA e entra em modo elevado. Retorna { c, segredo }. */
export async function adminElevado(app, db, { elevar = true } = {}) {
  await criarUsuario(db, 'admin', SENHA);
  const c = cliente(app);
  await c.post('/api/login', { usuario: 'admin', senha: SENHA });
  const { json } = await c.post('/api/2fa/iniciar');
  await c.post('/api/2fa/ativar', { codigo: codigoAtual(json.segredo) });
  if (elevar) {
    // O passo atual já foi usado na ativação (proteção contra reuso); usa o próximo.
    await c.post('/api/elevar', { codigo: codigoAtual(json.segredo, 1) });
  }
  return { c, segredo: json.segredo };
}

export const INFO = { hostname: 'pc-teste', so: 'Windows', so_versao: '11', arquitetura: 'AMD64', versao_agente: '0.1.0' };

export function metricas(extra = {}) {
  return {
    cpu: 12.5, ram_usada: 4e9, ram_total: 16e9, uptime: 3600, usuario: 'joao', ip: '10.0.0.5',
    discos: [{ ponto: 'C:\\', fs: 'NTFS', total: 500e9, usado: 200e9, pct: 40 }],
    ...extra,
  };
}

/** Gera token de instalação pela API e registra um agente. */
export async function registrarAgente(app, c, info = INFO) {
  const { json: tok } = await c.post('/api/tokens-instalacao', { descricao: 'teste' });
  const r = await app.inject({ method: 'POST', url: '/api/agente/registrar', payload: { token: tok.token, info } });
  const { id, segredo } = r.json();
  const auth = { authorization: `Bearer ${id}:${segredo}` };
  const checkin = (m = metricas(), extra = {}) => app.inject({ method: 'POST', url: '/api/agente/checkin', headers: auth, payload: { metricas: m, ...extra } });
  const resultado = (payload) => app.inject({ method: 'POST', url: '/api/agente/resultado', headers: auth, payload });
  return { id, segredo, auth, checkin, resultado, token: tok.token };
}
