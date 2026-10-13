// Terminal interativo: sessão de relay 'terminal' (abrir → enviar dados → eco → fechar), permissão negada
// para 'leitura', configuração de gravação opt-in e auditoria genérica do relay (abertura/fechamento).
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

/** Agente falso: abre a sessão de terminal e ecoa tudo que receber (fica no lugar do shell real). */
function agenteFalso(base, ag) {
  const c = conectar(`ws://${base}/api/agente/ws`, { authorization: ag.auth.authorization });
  c.ws.on('message', (d) => {
    const m = JSON.parse(d.toString());
    if (m.t === 'relay.abrir') c.enviar({ t: 'relay.aberta', sessao: m.sessao });
    if (m.t === 'relay.dados') c.enviar({ t: 'relay.dados', sessao: m.sessao, d: m.d });
  });
  return c;
}

test('terminal: abrir sessão, enviar dados, receber eco e fechar (auditado pelo relay)', async () => {
  const { app, db, base } = await subir();
  const { c } = await adminElevado(app, db);
  const ag = await registrarAgente(app, c);
  await ag.checkin(metricas());
  const agente = agenteFalso(base, ag);
  await agente.aberto;

  const painel = conectar(`ws://${base}/api/ws`, { cookie: c.cookie, origin: `http://${base}` });
  await painel.aberto;
  await painel.esperar((m) => m.tipo === 'ola');

  painel.enviar({ t: 'relay.abrir', ref: 'r1', agente_id: ag.id, tipo: 'terminal' });
  const aberta = await painel.esperar((m) => m.tipo === 'relay' && m.dados.e === 'aberta' && m.dados.ref === 'r1');
  const sessao = aberta.dados.sessao;

  painel.enviar({ t: 'relay.dados', sessao, d: 'echo ola\r' });
  const eco = await painel.esperar((m) => m.tipo === 'relay' && m.dados.e === 'dados');
  assert.equal(eco.dados.d, 'echo ola\r');

  painel.enviar({ t: 'relay.fechar', sessao });
  await agente.esperar((m) => m.t === 'relay.fechar' && m.sessao === sessao);
  await new Promise((r) => setTimeout(r, 50));

  const acoes = db.prepare("SELECT acao, detalhes FROM auditoria WHERE acao LIKE 'relay_%'").all();
  assert.deepEqual(acoes.map((a) => a.acao), ['relay_aberto', 'relay_fechado']);
  assert.match(acoes[0].detalhes, /"tipo":"terminal"/);

  agente.ws.close();
  await app.close();
});

test('terminal: permissão negada para o papel leitura; exige 2FA/elevação', async () => {
  const { app, db, base } = await subir();
  const { c: cAdmin } = await adminElevado(app, db);
  const ag = await registrarAgente(app, cAdmin);
  await ag.checkin(metricas());
  const agente = agenteFalso(base, ag);
  await agente.aberto;

  const { c } = await adminElevado(app, db, { usuario: 'leitor', papel: 'leitura' });
  const painel = conectar(`ws://${base}/api/ws`, { cookie: c.cookie, origin: `http://${base}` });
  await painel.aberto;
  await painel.esperar((m) => m.tipo === 'ola');
  painel.enviar({ t: 'relay.abrir', ref: 'rneg', agente_id: ag.id, tipo: 'terminal' });
  const erro = await painel.esperar((m) => m.tipo === 'relay' && m.dados.ref === 'rneg' && m.dados.e === 'erro');
  assert.match(erro.dados.erro, /permiss/i);

  // técnico sem elevar: 2FA ativo mas não confirmado agora
  const { c: cTec } = await adminElevado(app, db, { usuario: 'tec', papel: 'tecnico', elevar: false });
  const painel2 = conectar(`ws://${base}/api/ws`, { cookie: cTec.cookie, origin: `http://${base}` });
  await painel2.aberto;
  await painel2.esperar((m) => m.tipo === 'ola');
  painel2.enviar({ t: 'relay.abrir', ref: 'rtec', agente_id: ag.id, tipo: 'terminal' });
  const erro2 = await painel2.esperar((m) => m.tipo === 'relay' && m.dados.ref === 'rtec' && m.dados.e === 'erro');
  assert.equal(erro2.dados.precisaElevar, true);

  agente.ws.close();
  await app.close();
});

test('configuração: só admin configura; gravação opt-in grava a transcrição quando ligada', async () => {
  const { app, db, base } = await subir();
  const { c } = await adminElevado(app, db);
  const ag = await registrarAgente(app, c);
  await ag.checkin(metricas());

  // padrão: desligado
  const padrao = await c.get('/api/terminal/config');
  assert.equal(padrao.json.gravar_sessoes, false);
  assert.equal(padrao.json.timeout_ocioso_min, 20);

  // técnico não pode alterar a configuração (só usar)
  const { c: cTec } = await adminElevado(app, db, { usuario: 'tec', papel: 'tecnico' });
  const negado = await cTec.put('/api/terminal/config', { gravar_sessoes: true });
  assert.equal(negado.status, 403);
  assert.equal((await cTec.get('/api/terminal/config')).status, 200, 'técnico pode ler (precisa saber se está sendo gravado)');

  const ok = await c.put('/api/terminal/config', { gravar_sessoes: true, timeout_ocioso_min: 5 });
  assert.equal(ok.status, 200);
  assert.equal(ok.json.gravar_sessoes, true);

  const agente = agenteFalso(base, ag);
  await agente.aberto;
  const painel = conectar(`ws://${base}/api/ws`, { cookie: c.cookie, origin: `http://${base}` });
  await painel.aberto;
  await painel.esperar((m) => m.tipo === 'ola');
  painel.enviar({ t: 'relay.abrir', ref: 'rg', agente_id: ag.id, tipo: 'terminal' });
  const aberta = await painel.esperar((m) => m.tipo === 'relay' && m.dados.e === 'aberta' && m.dados.ref === 'rg');
  const sessao = aberta.dados.sessao;
  painel.enviar({ t: 'relay.dados', sessao, d: 'whoami' });
  await painel.esperar((m) => m.tipo === 'relay' && m.dados.e === 'dados');
  painel.enviar({ t: 'relay.fechar', sessao });
  await new Promise((r) => setTimeout(r, 80));

  const gravado = db.prepare('SELECT direcao, dados FROM terminal_gravacoes WHERE sessao_id = ? ORDER BY id').all(sessao);
  assert.deepEqual(gravado.map((g) => [g.direcao, g.dados]), [['painel', 'whoami'], ['agente', 'whoami']]);

  const r = await c.get(`/api/agentes/${ag.id}/terminal-gravacoes`);
  assert.equal(r.status, 200);
  assert.ok(r.json.length >= 2);

  agente.ws.close();
  await app.close();
});
