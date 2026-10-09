// Canal em tempo real com servidor de verdade (porta aleatória) e clientes WebSocket (pacote ws).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import WebSocket from 'ws';
import { novoApp, adminElevado, registrarAgente, metricas } from './ajuda.js';

async function subir() {
  const ctxApp = await novoApp();
  await ctxApp.app.listen({ port: 0, host: '127.0.0.1' });
  const porta = ctxApp.app.server.address().port;
  return { ...ctxApp, porta, base: `127.0.0.1:${porta}` };
}

/** Cliente WS que guarda as mensagens e permite esperar uma que satisfaça um predicado. */
function conectar(url, headers) {
  const ws = new WebSocket(url, { headers });
  const recebidas = [];
  const esperas = [];
  ws.on('message', (d) => {
    const m = JSON.parse(d.toString());
    recebidas.push(m);
    for (const e of [...esperas]) if (e.pred(m)) { esperas.splice(esperas.indexOf(e), 1); e.res(m); }
  });
  const esperar = (pred, ms = 3000) => {
    const ja = recebidas.find(pred);
    if (ja) { recebidas.splice(recebidas.indexOf(ja), 1); return Promise.resolve(ja); }
    return new Promise((res, rej) => {
      const e = { pred, res };
      esperas.push(e);
      setTimeout(() => rej(new Error('tempo esgotado esperando mensagem')), ms).unref();
    });
  };
  const aberto = new Promise((res, rej) => { ws.once('open', res); ws.once('error', rej); ws.once('unexpected-response', (_q, r) => rej(new Error(`HTTP ${r.statusCode}`))); });
  return { ws, esperar, aberto, enviar: (o) => ws.send(JSON.stringify(o)) };
}

/** Agente falso: responde ping e ecoa sessões 'eco'. */
function agenteFalso(base, ag) {
  const c = conectar(`ws://${base}/api/agente/ws`, { authorization: ag.auth.authorization });
  c.ws.on('message', (d) => {
    const m = JSON.parse(d.toString());
    if (m.t === 'cmd' && m.tipo === 'ping') c.enviar({ t: 'res', id: m.id, ok: true, dados: { pong: true } });
    if (m.t === 'cmd' && m.tipo === 'quebrado') c.enviar({ t: 'res', id: m.id, ok: false, erro: 'comando desconhecido: quebrado' });
    if (m.t === 'relay.abrir') c.enviar({ t: 'relay.aberta', sessao: m.sessao });
    if (m.t === 'relay.dados') c.enviar({ t: 'relay.dados', sessao: m.sessao, d: m.d === 'ping' ? 'pong' : m.d });
  });
  return c;
}

test('agente WS: autenticação, comando ping em tempo real e erro do agente', async () => {
  const { app, db, ctx, base } = await subir();
  const { c } = await adminElevado(app, db, { elevar: false });
  const ag = await registrarAgente(app, c);
  await ag.checkin(metricas());

  // sem credencial: recusado
  await assert.rejects(conectar(`ws://${base}/api/agente/ws`, {}).aberto, /401/);
  // sem canal: ping recusa (fila: false)
  assert.equal((await c.post(`/api/agentes/${ag.id}/ping`)).status, 409);

  const agente = agenteFalso(base, ag);
  await agente.aberto;
  const ola = await agente.esperar((m) => m.t === 'ola');
  assert.equal(ola.intervalo, 15);
  assert.equal(ctx.canalAgentes.conectado(ag.id), true);
  assert.equal((await c.get(`/api/agentes/${ag.id}`)).json.tempo_real, true);

  const r = await c.post(`/api/agentes/${ag.id}/ping`);
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal(r.json.pong, true);
  assert.ok(r.json.latencia_ms >= 0);
  assert.equal(db.prepare("SELECT status FROM comandos WHERE tipo = 'ping'").get().status, 'sucesso');

  const { resultado } = ctx.comandos.enviar(ag.id, 'quebrado', {});
  await assert.rejects(resultado, /desconhecido/);

  agente.ws.close();
  await app.close();
});

test('comandos ficam na fila sem canal e seguem no check-in; resultado por HTTP', async () => {
  const { app, db, ctx } = await novoApp();
  const { c } = await adminElevado(app, db, { elevar: false });
  const ag = await registrarAgente(app, c);
  const { id, entregue, resultado } = ctx.comandos.enviar(ag.id, 'processos.listar', { limite: 5 }, { timeoutMs: 5000 });
  assert.equal(entregue, false);
  const ck = (await ag.checkin()).json();
  assert.deepEqual(ck.comandos, [{ id, tipo: 'processos.listar', args: { limite: 5 } }]);
  assert.equal(ck.tempoReal, '/api/agente/ws');
  assert.deepEqual((await ag.checkin()).json().comandos, [], 'não entrega duas vezes');
  const r = await app.inject({ method: 'POST', url: '/api/agente/comando-resultado', headers: ag.auth, payload: { id, ok: true, dados: [{ pid: 1 }] } });
  assert.equal(r.statusCode, 200);
  assert.deepEqual(await resultado, [{ pid: 1 }]);
  const r2 = await app.inject({ method: 'POST', url: '/api/agente/comando-resultado', headers: ag.auth, payload: { id, ok: true } });
  assert.equal(r2.statusCode, 404, 'já concluído');
  // expiração
  const { id: id2 } = ctx.comandos.enviar(ag.id, 'x.y', {}, { timeoutMs: 10, validadeMs: 10 });
  assert.equal(ctx.comandos.expirar(Date.now() + 1000), 1);
  assert.equal(db.prepare('SELECT status FROM comandos WHERE id = ?').get(id2).status, 'expirado');
  await app.close();
});

test('relay: sessão eco ping→pong painel⇄agente, auditada; job acorda o agente', async () => {
  const { app, db, base } = await subir();
  const { c } = await adminElevado(app, db);
  const ag = await registrarAgente(app, c);
  await ag.checkin(metricas());
  const agente = agenteFalso(base, ag);
  await agente.aberto;

  const painel = conectar(`ws://${base}/api/ws`, { cookie: c.cookie, origin: `http://${base}` });
  await painel.aberto;
  await painel.esperar((m) => m.tipo === 'ola');

  // tipo desconhecido e dispositivo inexistente
  painel.enviar({ t: 'relay.abrir', ref: 'r0', agente_id: ag.id, tipo: 'nao-existe' });
  assert.match((await painel.esperar((m) => m.tipo === 'relay' && m.dados.ref === 'r0' && m.dados.e === 'erro')).dados.erro, /desconhecido/);

  painel.enviar({ t: 'relay.abrir', ref: 'r1', agente_id: ag.id, tipo: 'eco' });
  const aberta = await painel.esperar((m) => m.tipo === 'relay' && m.dados.e === 'aberta' && m.dados.ref === 'r1');
  const sessao = aberta.dados.sessao;
  assert.match(sessao, /^[0-9a-f-]{36}$/);

  painel.enviar({ t: 'relay.dados', sessao, d: 'ping' });
  const pong = await painel.esperar((m) => m.tipo === 'relay' && m.dados.e === 'dados');
  assert.equal(pong.dados.d, 'pong');

  painel.enviar({ t: 'relay.fechar', sessao });
  await agente.esperar((m) => m.t === 'relay.fechar' && m.sessao === sessao);
  await new Promise((r) => setTimeout(r, 50));
  const reg = db.prepare('SELECT * FROM relay_sessoes WHERE id = ?').get(sessao);
  assert.ok(reg.fechada_em);
  assert.equal(reg.bytes_painel, 4);
  assert.equal(reg.bytes_agente, 4);
  const acoes = db.prepare("SELECT acao FROM auditoria WHERE acao LIKE 'relay_%'").all().map((r) => r.acao);
  assert.deepEqual(acoes, ['relay_aberto', 'relay_fechado']);

  // um job novo manda {t:'checkin'} para o agente conectado
  await c.post('/api/executar', { agentes: [ag.id], comando: 'echo oi', shell: 'bash' });
  await agente.esperar((m) => m.t === 'checkin');

  // sessão fechada se o agente cai
  painel.enviar({ t: 'relay.abrir', ref: 'r2', agente_id: ag.id, tipo: 'eco' });
  await painel.esperar((m) => m.tipo === 'relay' && m.dados.e === 'aberta' && m.dados.ref === 'r2');
  agente.ws.close();
  const fechada = await painel.esperar((m) => m.tipo === 'relay' && m.dados.e === 'fechada' && m.dados.ref === 'r2');
  assert.match(fechada.dados.motivo, /desconectou/);

  // logout fecha o WebSocket do painel
  const fechou = new Promise((r) => painel.ws.once('close', r));
  await c.post('/api/logout');
  await fechou;
  await app.close();
});

test('WS do painel recusa sem sessão e com origem estranha', async () => {
  const { app, db, base } = await subir();
  const { c } = await adminElevado(app, db, { elevar: false });
  await assert.rejects(conectar(`ws://${base}/api/ws`, {}).aberto, /401/);
  await assert.rejects(conectar(`ws://${base}/api/ws`, { cookie: c.cookie, origin: 'null' }).aberto, /403/);
  await assert.rejects(conectar(`ws://${base}/api/ws`, { cookie: c.cookie, origin: 'https://malicioso.exemplo' }).aberto, /403/);
  await app.close();
});

test('pacote do agente (.pyz) é um zip válido com __main__.py', async () => {
  const { app } = await novoApp();
  const r = await app.inject('/download/farol-agente.pyz');
  assert.equal(r.statusCode, 200);
  const buf = r.rawPayload;
  assert.equal(buf.readUInt32LE(0), 0x04034b50);
  assert.ok(buf.includes(Buffer.from('__main__.py')));
  assert.ok(buf.includes(Buffer.from('farol/cli.py')));
  assert.match(r.headers['x-farol-sha256'], /^[0-9a-f]{64}$/);
  await app.close();
});
