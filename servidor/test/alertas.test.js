import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { novoApp, adminElevado, registrarAgente, metricas } from './ajuda.js';
import { tarefasPeriodicas } from '../src/app.js';

const abertos = async (c) => (await c.get('/api/alertas?status=aberto')).json;

test('CPU alta por N check-ins abre alerta e resolve ao normalizar', async () => {
  const { app, db } = await novoApp();
  const { c } = await adminElevado(app, db, { elevar: false });
  const ag = await registrarAgente(app, c);
  for (let i = 0; i < 3; i++) await ag.checkin(metricas({ cpu: 97 }));
  assert.equal((await abertos(c)).length, 0, 'ainda abaixo de 4 ciclos');
  await ag.checkin(metricas({ cpu: 97 }));
  const lista = await abertos(c);
  assert.equal(lista.length, 1);
  assert.equal(lista[0].tipo, 'cpu');
  await ag.checkin(metricas({ cpu: 99 }));
  assert.equal((await abertos(c)).length, 1, 'não duplica');
  await ag.checkin(metricas({ cpu: 20 }));
  assert.equal((await abertos(c)).length, 0);
  assert.equal((await c.get('/api/alertas?status=resolvido')).json.length, 1);
  await app.close();
});

test('disco e RAM acima do limite', async () => {
  const { app, db } = await novoApp();
  const { c } = await adminElevado(app, db, { elevar: false });
  const ag = await registrarAgente(app, c);
  const cheio = metricas({ ram_usada: 15.5e9, discos: [{ ponto: '/', total: 100, usado: 95, pct: 95 }] });
  for (let i = 0; i < 4; i++) await ag.checkin(cheio);
  const tipos = (await abertos(c)).map((a) => a.tipo).sort();
  assert.deepEqual(tipos, ['disco', 'ram']);
  await ag.checkin(metricas());
  assert.equal((await abertos(c)).length, 0);
  await app.close();
});

test('offline prolongado abre alerta; check-in resolve', async () => {
  const { app, db, ctx } = await novoApp();
  const { c } = await adminElevado(app, db, { elevar: false });
  const ag = await registrarAgente(app, c);
  await ag.checkin();
  tarefasPeriodicas(ctx, Date.now() + 2 * 60_000);
  assert.equal((await abertos(c)).length, 0, 'offline, mas ainda dentro dos 5 min');
  tarefasPeriodicas(ctx, Date.now() + 6 * 60_000);
  const lista = await abertos(c);
  assert.equal(lista.length, 1);
  assert.equal(lista[0].tipo, 'offline');
  await ag.checkin();
  assert.equal((await abertos(c)).length, 0);
  await app.close();
});

test('mudança de regras é validada, aplicada e auditada', async () => {
  const { app, db } = await novoApp();
  const { c } = await adminElevado(app, db, { elevar: false });
  const ag = await registrarAgente(app, c);
  const cfg = (await c.get('/api/config')).json;
  assert.equal(cfg.regras.cpu.limite, 90);
  assert.equal((await c.put('/api/config', { regras: { ...cfg.regras, cpu: { ativo: true, limite: 500, ciclos: 1 } } })).status, 400);
  const r = await c.put('/api/config', { regras: { ...cfg.regras, cpu: { ativo: true, limite: 50, ciclos: 1 } }, webhook_url: '' });
  assert.equal(r.status, 200);
  await ag.checkin(metricas({ cpu: 60 }));
  assert.equal((await abertos(c))[0].tipo, 'cpu');
  assert.ok(db.prepare("SELECT 1 FROM auditoria WHERE acao = 'regras_alteradas'").get());
  await app.close();
});

test('webhook recebe POST JSON quando um alerta abre', async () => {
  const recebidos = [];
  const srv = createServer((req, res) => {
    let corpo = '';
    req.on('data', (d) => { corpo += d; });
    req.on('end', () => { recebidos.push(JSON.parse(corpo)); res.end('ok'); });
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${srv.address().port}/hook`;
  const { app, db } = await novoApp();
  const { c } = await adminElevado(app, db, { elevar: false });
  const ag = await registrarAgente(app, c);
  const cfg = (await c.get('/api/config')).json;
  await c.put('/api/config', { regras: cfg.regras, webhook_url: url });
  await ag.checkin(metricas({ discos: [{ ponto: 'D:\\', total: 1, usado: 1, pct: 99 }] }));
  for (let i = 0; i < 50 && !recebidos.length; i++) await new Promise((r) => setTimeout(r, 20));
  assert.equal(recebidos.length, 1);
  assert.equal(recebidos[0].alerta.tipo, 'disco');
  assert.match(recebidos[0].content, /pc-teste/);
  await app.close();
  srv.close();
});

test('auditoria com filtros', async () => {
  const { app, db } = await novoApp();
  const { c } = await adminElevado(app, db, { elevar: false });
  await c.post('/api/tokens-instalacao', { descricao: 'Matriz 100%' });
  const tudo = (await c.get('/api/auditoria')).json;
  assert.ok(tudo.linhas.length >= 3);
  assert.ok(tudo.acoes.includes('login'));
  const so = (await c.get('/api/auditoria?acao=token_criado')).json.linhas;
  assert.equal(so.length, 1);
  assert.equal(so[0].usuario, 'admin');
  assert.equal(so[0].ip, '127.0.0.1');
  assert.equal((await c.get('/api/auditoria?q=' + encodeURIComponent('100%'))).json.linhas.length, 1);
  assert.equal((await c.get('/api/auditoria?q=inexistente')).json.linhas.length, 0);
  await app.close();
});
