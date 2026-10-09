import { test } from 'node:test';
import assert from 'node:assert/strict';
import { novoApp, adminElevado, registrarAgente, metricas, INFO } from './ajuda.js';
import { tarefasPeriodicas } from '../src/app.js';

test('token de instalação: uso único, inválido e expirado', async () => {
  const { app, db } = await novoApp();
  const { c } = await adminElevado(app, db, { elevar: false });
  const { json: tok } = await c.post('/api/tokens-instalacao', { descricao: 'filial' });
  assert.equal(tok.token.length, 43);
  assert.match(tok.comandos.windows, /farol_agente\.py instalar --servidor/);
  assert.match(tok.comandos.linux, /curl -fsSLO/);
  assert.notEqual(db.prepare('SELECT token_hash FROM tokens_instalacao').get().token_hash, tok.token, 'só hash no banco');

  const registrar = (token) => app.inject({ method: 'POST', url: '/api/agente/registrar', payload: { token, info: INFO } });
  const r1 = await registrar(tok.token);
  assert.equal(r1.statusCode, 200);
  assert.match(r1.json().id, /^[0-9a-f-]{36}$/);
  assert.ok(r1.json().segredo.length >= 40);
  const agente = db.prepare('SELECT segredo_hash FROM agentes').get();
  assert.notEqual(agente.segredo_hash, r1.json().segredo);

  const r2 = await registrar(tok.token);
  assert.equal(r2.statusCode, 401);
  assert.match(r2.json().erro, /já foi usado/);

  assert.equal((await registrar('x'.repeat(43))).statusCode, 401);

  const { json: tok2 } = await c.post('/api/tokens-instalacao', {});
  db.prepare('UPDATE tokens_instalacao SET expira_em = ? WHERE id = ?').run(Date.now() - 1, tok2.id);
  const r3 = await registrar(tok2.token);
  assert.equal(r3.statusCode, 401);
  assert.match(r3.json().erro, /expirado/);

  const acoes = db.prepare('SELECT acao FROM auditoria').all().map((r) => r.acao);
  assert.ok(acoes.includes('token_criado'));
  assert.ok(acoes.includes('agente_registrado'));
  assert.ok(acoes.includes('agente_registro_negado'));
  await app.close();
});

test('check-in autenticado grava métricas; sem/segredo errado/revogado é negado', async () => {
  const { app, db } = await novoApp();
  const { c } = await adminElevado(app, db, { elevar: false });
  const ag = await registrarAgente(app, c);

  const ok = await ag.checkin(metricas(), { inventario: { sistema: { so: 'Windows' }, softwares: [{ nome: 'Firefox', versao: '130' }] } });
  assert.equal(ok.statusCode, 200);
  assert.deepEqual(ok.json().jobs, []);
  assert.equal(ok.json().intervalo, 15);
  assert.equal(ok.json().pedirInventario, false);

  const det = (await c.get(`/api/agentes/${ag.id}`)).json;
  assert.equal(det.status, 'online');
  assert.equal(det.cpu_pct, 12.5);
  assert.equal(det.inventario.softwares[0].nome, 'Firefox');
  assert.equal(det.discos[0].pct, 40);
  const met = (await c.get(`/api/agentes/${ag.id}/metricas?horas=24`)).json;
  assert.equal(met.pontos.length, 1);
  assert.equal(met.pontos[0].ram, 25);

  const semAuth = await app.inject({ method: 'POST', url: '/api/agente/checkin', payload: { metricas: metricas() } });
  assert.equal(semAuth.statusCode, 401);
  const errado = await app.inject({ method: 'POST', url: '/api/agente/checkin', headers: { authorization: `Bearer ${ag.id}:${'a'.repeat(43)}` }, payload: { metricas: metricas() } });
  assert.equal(errado.statusCode, 401);

  assert.equal((await c.post(`/api/agentes/${ag.id}/revogar`)).status, 200);
  assert.equal((await ag.checkin()).statusCode, 401);
  assert.equal((await c.get('/api/agentes')).json.length, 0);
  assert.ok(db.prepare("SELECT 1 FROM auditoria WHERE acao = 'agente_revogado'").get());
  await app.close();
});

test('validação de entrada: métricas fora do formato são recusadas', async () => {
  const { app, db } = await novoApp();
  const { c } = await adminElevado(app, db, { elevar: false });
  const ag = await registrarAgente(app, c);
  assert.equal((await ag.checkin({ cpu: 'muito' })).statusCode, 400);
  assert.equal((await ag.checkin({ cpu: 150 })).statusCode, 400);
  assert.equal((await c.get('/api/agentes/nao-e-uuid')).status, 400);
  await app.close();
});

test('agente fica offline sem check-in em 60 s e volta ao fazer check-in', async () => {
  const { app, db, ctx } = await novoApp();
  const { c } = await adminElevado(app, db, { elevar: false });
  const ag = await registrarAgente(app, c);
  await ag.checkin();
  tarefasPeriodicas(ctx, Date.now() + 61_000);
  assert.equal((await c.get(`/api/agentes/${ag.id}`)).json.status, 'offline');
  await ag.checkin();
  assert.equal((await c.get(`/api/agentes/${ag.id}`)).json.status, 'online');
  await app.close();
});

test('resumo da visão geral', async () => {
  const { app, db } = await novoApp();
  const { c } = await adminElevado(app, db, { elevar: false });
  const ag = await registrarAgente(app, c);
  await ag.checkin(metricas({ cpu: 70 }));
  const r = (await c.get('/api/resumo')).json;
  assert.equal(r.total, 1);
  assert.equal(r.online, 1);
  assert.equal(r.piores[0].hostname, 'pc-teste');
  await app.close();
});
