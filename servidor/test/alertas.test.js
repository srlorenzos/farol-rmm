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
  await tarefasPeriodicas(ctx, Date.now() + 2 * 60_000);
  assert.equal((await abertos(c)).length, 0, 'offline, mas ainda dentro dos 5 min');
  await tarefasPeriodicas(ctx, Date.now() + 6 * 60_000);
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

test('janela de manutenção suprime webhook e contagem; volta a disparar depois de expirar', async () => {
  const recebidos = [];
  const srv = createServer((req, res) => {
    let corpo = '';
    req.on('data', (d) => { corpo += d; });
    req.on('end', () => { recebidos.push(JSON.parse(corpo)); res.end('ok'); });
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${srv.address().port}/hook`;
  const { app, db, ctx } = await novoApp();
  const { c } = await adminElevado(app, db, { elevar: false });
  const ag = await registrarAgente(app, c);
  const cfg = (await c.get('/api/config')).json;
  await c.put('/api/config', { regras: cfg.regras, webhook_url: url });
  const agente = { id: ag.id, hostname: 'pc-teste' };

  // 1) sem manutenção: alerta normal dispara webhook e conta como aberto.
  ctx.servicos.alertas.abrir(agente, { tipo: 'cpu', mensagem: 'cpu alta', valor: 95, severidade: 'alerta' });
  for (let i = 0; i < 50 && !recebidos.length; i++) await new Promise((r) => setTimeout(r, 20));
  assert.equal(recebidos.length, 1, 'primeira abertura dispara webhook');
  assert.equal((await abertos(c))[0].suprimido, 0);
  ctx.servicos.alertas.resolver(agente, 'cpu');
  assert.equal((await abertos(c)).length, 0);

  // 2) janela de manutenção curta (150 ms) para o agente.
  const agora = Date.now();
  const jan = await c.post('/api/alertas/manutencao', { alvo: { tipo: 'agente', id: ag.id }, inicio: agora, fim: agora + 150, motivo: 'teste' });
  assert.equal(jan.status, 200);
  assert.equal(jan.json.estado, 'ativa');

  // 3) com a janela ativa: abre (fica auditável) mas não dispara webhook nem conta no resumo.
  recebidos.length = 0;
  ctx.servicos.alertas.abrir(agente, { tipo: 'cpu', mensagem: 'cpu alta de novo', valor: 96, severidade: 'alerta' });
  await new Promise((r) => setTimeout(r, 80));
  assert.equal(recebidos.length, 0, 'não dispara webhook durante a manutenção');
  let lista = (await c.get(`/api/alertas?status=aberto&agente=${ag.id}`)).json;
  assert.equal(lista.length, 1);
  assert.equal(lista[0].suprimido, 1, 'fica registrado como suprimido, não escondido');
  let resumo = (await c.get('/api/alertas/resumo')).json;
  assert.equal(resumo.abertos, 0, 'não conta como aberto no resumo/dashboard');
  assert.equal(resumo.suprimidos, 1);
  const disp = (await c.get('/api/agentes')).json.find((a) => a.id === ag.id);
  assert.equal(disp.em_manutencao, true);
  ctx.servicos.alertas.resolver(agente, 'cpu');

  // 4) depois que a janela expira: volta a disparar normalmente.
  await new Promise((r) => setTimeout(r, 200));
  recebidos.length = 0;
  ctx.servicos.alertas.abrir(agente, { tipo: 'cpu', mensagem: 'cpu alta outra vez', valor: 97, severidade: 'alerta' });
  for (let i = 0; i < 50 && !recebidos.length; i++) await new Promise((r) => setTimeout(r, 20));
  assert.equal(recebidos.length, 1, 'webhook volta a disparar depois da janela expirar');
  lista = (await c.get(`/api/alertas?status=aberto&agente=${ag.id}`)).json;
  assert.equal(lista[0].suprimido, 0);

  await app.close();
  srv.close();
});

test('cancelar a janela de manutenção reabre a contagem imediatamente', async () => {
  const { app, db, ctx } = await novoApp();
  const { c } = await adminElevado(app, db, { elevar: false });
  const ag = await registrarAgente(app, c);
  const agente = { id: ag.id, hostname: 'pc-teste' };
  const jan = (await c.post('/api/alertas/manutencao', { alvo: { tipo: 'agente', id: ag.id }, duracaoMin: 60 })).json;
  ctx.servicos.alertas.abrir(agente, { tipo: 'ram', mensagem: 'ram alta', valor: 95 });
  assert.equal((await c.get('/api/alertas/resumo')).json.abertos, 0, 'suprimido enquanto a janela está ativa');
  const listaJanelas = (await c.get('/api/alertas/manutencao')).json;
  assert.equal(listaJanelas.find((m) => m.id === jan.id).estado, 'ativa');
  const canc = await c.post(`/api/alertas/manutencao/${jan.id}/cancelar`);
  assert.equal(canc.status, 200);
  assert.equal((await c.post(`/api/alertas/manutencao/${jan.id}/cancelar`)).status, 404, 'cancelar de novo é recusado');
  ctx.servicos.alertas.abrir(agente, { tipo: 'ram', mensagem: 'ram alta de novo', valor: 96 });
  assert.equal((await c.get('/api/alertas/resumo')).json.abertos, 1, 'volta a contar depois do cancelamento');
  await app.close();
});

test('override de limiar por agente muda o ponto de disparo', async () => {
  const { app, db } = await novoApp();
  const { c } = await adminElevado(app, db, { elevar: false });
  const ag = await registrarAgente(app, c); // regra global: CPU > 90% por 4 ciclos
  const r = await c.put('/api/alertas/overrides', { agente_id: ag.id, tipo: 'cpu', limite: 95, ciclos: 1 });
  assert.equal(r.status, 200);
  assert.deepEqual((await c.get(`/api/alertas/overrides?agente=${ag.id}`)).json.map((o) => o.tipo), ['cpu']);
  await ag.checkin(metricas({ cpu: 92 })); // abaixo do override (95%), mesmo com ciclos=1 não abre
  assert.equal((await abertos(c)).length, 0);
  await ag.checkin(metricas({ cpu: 97 }));
  const lista = await abertos(c);
  assert.equal(lista.length, 1);
  assert.equal(lista[0].tipo, 'cpu');
  // remover o override (todos os campos null) volta ao padrão global
  await c.put('/api/alertas/overrides', { agente_id: ag.id, tipo: 'cpu', limite: null, ciclos: null, ativo: null });
  assert.equal((await c.get(`/api/alertas/overrides?agente=${ag.id}`)).json.length, 0);
  await app.close();
});

test('override "desligado" nunca dispara para aquele agente mesmo que outros do mesmo tipo disparem', async () => {
  const { app, db } = await novoApp();
  const { c } = await adminElevado(app, db, { elevar: false });
  const ag1 = await registrarAgente(app, c);
  const ag2 = await registrarAgente(app, c);
  await c.put('/api/alertas/overrides', { agente_id: ag1.id, tipo: 'disco', ativo: false });
  const cheio = metricas({ discos: [{ ponto: 'C:\\', total: 100, usado: 95, pct: 95 }] });
  await ag1.checkin(cheio);
  await ag2.checkin(cheio);
  const lista = await abertos(c);
  assert.equal(lista.filter((a) => a.agente_id === ag1.id).length, 0, 'disco desligado via override neste agente');
  assert.equal(lista.filter((a) => a.agente_id === ag2.id).length, 1, 'outro agente continua com a regra padrão');
  await app.close();
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
