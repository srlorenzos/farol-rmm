import { test } from 'node:test';
import assert from 'node:assert/strict';
import { novoApp, cliente, codigoAtual, SENHA } from './ajuda.js';
import { criarUsuario } from '../src/rotas/auth.js';

test('setup inicial só funciona sem usuários e exige senha forte', async () => {
  const { app } = await novoApp();
  const c = cliente(app);
  assert.equal((await c.get('/api/estado')).json.precisaSetup, true);
  assert.equal((await c.post('/api/setup', { usuario: 'admin', senha: 'fraca' })).status, 400);
  assert.equal((await c.post('/api/setup', { usuario: 'admin', senha: 'semnumerosoumaiusculas' })).status, 400);
  const ok = await c.post('/api/setup', { usuario: 'admin', senha: SENHA });
  assert.equal(ok.status, 200);
  assert.match(String(ok.headers['set-cookie']), /HttpOnly; SameSite=Strict/);
  assert.equal((await c.get('/api/estado')).json.autenticado, true);
  const outro = cliente(app);
  assert.equal((await outro.post('/api/setup', { usuario: 'intruso', senha: SENHA })).status, 409);
  await app.close();
});

test('login, sessão, logout e cookie', async () => {
  const { app, db } = await novoApp();
  await criarUsuario(db, 'admin', SENHA);
  const c = cliente(app);
  assert.equal((await c.get('/api/agentes')).status, 401);
  assert.equal((await c.post('/api/login', { usuario: 'admin', senha: 'errada' })).status, 401);
  assert.equal((await c.post('/api/login', { usuario: 'ninguem', senha: SENHA })).status, 401);
  const r = await c.post('/api/login', { usuario: 'admin', senha: SENHA });
  assert.equal(r.status, 200);
  assert.doesNotMatch(String(r.headers['set-cookie']), /Secure/, 'sem HTTPS não marca Secure');
  // token guardado só como hash
  const s = db.prepare('SELECT token_hash FROM sessoes').get();
  assert.notEqual(s.token_hash, c.cookie.split('=')[1]);
  assert.equal((await c.get('/api/agentes')).status, 200);
  await c.post('/api/logout');
  assert.equal((await c.get('/api/agentes')).status, 401);
  await app.close();
});

test('cookie Secure quando a URL pública é HTTPS', async () => {
  const { app, db } = await novoApp({ https: true });
  await criarUsuario(db, 'admin', SENHA);
  const r = await cliente(app).post('/api/login', { usuario: 'admin', senha: SENHA });
  assert.match(String(r.headers['set-cookie']), /; Secure/);
  await app.close();
});

test('sessão expirada é recusada', async () => {
  const { app, db } = await novoApp();
  await criarUsuario(db, 'admin', SENHA);
  const c = cliente(app);
  await c.post('/api/login', { usuario: 'admin', senha: SENHA });
  db.prepare('UPDATE sessoes SET expira_em = ?').run(Date.now() - 1);
  assert.equal((await c.get('/api/agentes')).status, 401);
  await app.close();
});

test('bloqueio progressivo após 5 falhas', async () => {
  const { app, db } = await novoApp();
  await criarUsuario(db, 'admin', SENHA);
  const c = cliente(app);
  for (let i = 0; i < 5; i++) assert.equal((await c.post('/api/login', { usuario: 'admin', senha: 'errada' })).status, 401);
  const bloqueado = await c.post('/api/login', { usuario: 'admin', senha: SENHA });
  assert.equal(bloqueado.status, 429, 'mesmo com a senha certa, fica bloqueado');
  const u = db.prepare('SELECT falhas, bloqueado_ate FROM usuarios').get();
  assert.equal(u.falhas, 5);
  assert.ok(u.bloqueado_ate > Date.now() + 50_000);
  // após expirar o bloqueio, nova falha dobra o tempo
  db.prepare('UPDATE usuarios SET bloqueado_ate = 0').run();
  await c.post('/api/login', { usuario: 'admin', senha: 'errada' });
  const u2 = db.prepare('SELECT bloqueado_ate FROM usuarios').get();
  assert.ok(u2.bloqueado_ate > Date.now() + 110_000, 'segundo bloqueio maior');
  const acoes = db.prepare('SELECT acao FROM auditoria').all().map((r) => r.acao);
  assert.ok(acoes.includes('login_falha') && acoes.includes('login_bloqueado'));
  await app.close();
});

test('2FA: ativação, login exige código, código errado conta falha', async () => {
  const { app, db } = await novoApp();
  await criarUsuario(db, 'admin', SENHA);
  const c = cliente(app);
  await c.post('/api/login', { usuario: 'admin', senha: SENHA });
  const ini = await c.post('/api/2fa/iniciar');
  assert.match(ini.json.segredo, /^[A-Z2-7]{32}$/);
  assert.match(ini.json.uri, /^otpauth:\/\/totp\/Farol%20RMM%3Aadmin\?secret=/);
  assert.equal((await c.post('/api/2fa/ativar', { codigo: '000000' })).status, 400);
  assert.equal((await c.post('/api/2fa/ativar', { codigo: codigoAtual(ini.json.segredo) })).status, 200);
  await c.post('/api/logout');

  const sem = await c.post('/api/login', { usuario: 'admin', senha: SENHA });
  assert.equal(sem.status, 401);
  assert.equal(sem.json.precisa2fa, true);
  const errado = await c.post('/api/login', { usuario: 'admin', senha: SENHA, codigo: '123456' });
  assert.equal(errado.status, 401);
  assert.equal(db.prepare('SELECT falhas FROM usuarios').get().falhas, 1);
  const ok = await c.post('/api/login', { usuario: 'admin', senha: SENHA, codigo: codigoAtual(ini.json.segredo, 1) });
  assert.equal(ok.status, 200);
  await app.close();
});

test('CSRF: mutação sem header X-Farol é recusada', async () => {
  const { app, db } = await novoApp();
  await criarUsuario(db, 'admin', SENHA);
  const c = cliente(app);
  assert.equal((await c.post('/api/login', { usuario: 'admin', senha: SENHA }, { semCsrf: true })).status, 403);
  await c.post('/api/login', { usuario: 'admin', senha: SENHA });
  const r = await c.post('/api/tokens-instalacao', {}, { semCsrf: true });
  assert.equal(r.status, 403);
  assert.equal((await c.post('/api/tokens-instalacao', {})).status, 200);
  assert.equal((await c.del('/api/scripts/1', { semCsrf: true })).status, 403);
  await app.close();
});

test('cabeçalhos de segurança e CSP restrita', async () => {
  const { app } = await novoApp();
  const r = await app.inject('/');
  const csp = r.headers['content-security-policy'];
  assert.match(csp, /default-src 'self'/);
  assert.match(csp, /script-src 'self'(;|$)/);
  assert.doesNotMatch(csp, /unsafe-inline/);
  assert.equal(r.headers['x-content-type-options'], 'nosniff');
  await app.close();
});

test('rate limit no login', async () => {
  const { app } = await novoApp({ limites: { global: 1000, login: 3, registrar: 3 } });
  const c = cliente(app);
  for (let i = 0; i < 3; i++) await c.post('/api/login', { usuario: 'x', senha: 'y' });
  assert.equal((await c.post('/api/login', { usuario: 'x', senha: 'y' })).status, 429);
  await app.close();
});
