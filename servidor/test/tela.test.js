// Tela remota: sessão de relay 'tela' (mesma base do terminal) + o limite de 1 sessão simultânea por
// dispositivo (maxPorAgente, novo no núcleo do relay — ver src/nucleo/relay.js).
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

/** Agente falso: aceita abrir sessões de tela e ecoa "quadros" que mandarmos nele mesmo (fica no lugar da captura real). */
function agenteFalso(base, ag) {
  const c = conectar(`ws://${base}/api/agente/ws`, { authorization: ag.auth.authorization });
  c.ws.on('message', (d) => {
    const m = JSON.parse(d.toString());
    if (m.t === 'relay.abrir') c.enviar({ t: 'relay.aberta', sessao: m.sessao });
  });
  return c;
}

test('tela: abrir, mandar um quadro, fechar — auditado como qualquer sessão de relay', async () => {
  const { app, db, base } = await subir();
  const { c } = await adminElevado(app, db);
  const ag = await registrarAgente(app, c);
  await ag.checkin(metricas());
  const agente = agenteFalso(base, ag);
  await agente.aberto;

  const painel = conectar(`ws://${base}/api/ws`, { cookie: c.cookie, origin: `http://${base}` });
  await painel.aberto;
  await painel.esperar((m) => m.tipo === 'ola');

  painel.enviar({ t: 'relay.abrir', ref: 'r1', agente_id: ag.id, tipo: 'tela' });
  const aberta = await painel.esperar((m) => m.tipo === 'relay' && m.dados.e === 'aberta' && m.dados.ref === 'r1');
  const sessao = aberta.dados.sessao;

  // agente "captura" e manda um quadro falso (base64 cru, sem envelope — é assim que tela.py manda de verdade)
  agente.enviar({ t: 'relay.dados', sessao, d: 'ZmFrZS1qcGVn' });
  const quadro = await painel.esperar((m) => m.tipo === 'relay' && m.dados.e === 'dados');
  assert.equal(quadro.dados.d, 'ZmFrZS1qcGVn');

  // painel manda controle (mouse/teclado) — o agente só precisa receber, não validamos a injeção aqui (é SO)
  painel.enviar({ t: 'relay.dados', sessao, d: JSON.stringify({ tipo: 'mouse_mover', x: 0.5, y: 0.5 }) });
  await agente.esperar((m) => m.t === 'relay.dados' && m.sessao === sessao);

  painel.enviar({ t: 'relay.fechar', sessao });
  await agente.esperar((m) => m.t === 'relay.fechar' && m.sessao === sessao);
  await new Promise((r) => setTimeout(r, 50));

  const acoes = db.prepare("SELECT acao, detalhes FROM auditoria WHERE acao LIKE 'relay_%'").all();
  assert.deepEqual(acoes.map((a) => a.acao), ['relay_aberto', 'relay_fechado']);
  assert.match(acoes[0].detalhes, /"tipo":"tela"/);

  agente.ws.close();
  await app.close();
});

test('tela: permissão negada para leitura; exige 2FA/elevação pro técnico', async () => {
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
  painel.enviar({ t: 'relay.abrir', ref: 'rneg', agente_id: ag.id, tipo: 'tela' });
  const erro = await painel.esperar((m) => m.tipo === 'relay' && m.dados.ref === 'rneg' && m.dados.e === 'erro');
  assert.match(erro.dados.erro, /permiss/i);

  const { c: cTec } = await adminElevado(app, db, { usuario: 'tec', papel: 'tecnico', elevar: false });
  const painel2 = conectar(`ws://${base}/api/ws`, { cookie: cTec.cookie, origin: `http://${base}` });
  await painel2.aberto;
  await painel2.esperar((m) => m.tipo === 'ola');
  painel2.enviar({ t: 'relay.abrir', ref: 'rtec', agente_id: ag.id, tipo: 'tela' });
  const erro2 = await painel2.esperar((m) => m.tipo === 'relay' && m.dados.ref === 'rtec' && m.dados.e === 'erro');
  assert.equal(erro2.dados.precisaElevar, true);

  agente.ws.close();
  await app.close();
});

test('tela: ao abrir, avisa a bandeja do dispositivo (comando tela.notificar, best-effort)', async () => {
  const { app, db, base } = await subir();
  const { c } = await adminElevado(app, db);
  const ag = await registrarAgente(app, c);
  await ag.checkin(metricas());
  const agente = agenteFalso(base, ag);
  await agente.aberto;

  const painel = conectar(`ws://${base}/api/ws`, { cookie: c.cookie, origin: `http://${base}` });
  await painel.aberto;
  await painel.esperar((m) => m.tipo === 'ola');
  painel.enviar({ t: 'relay.abrir', ref: 'r1', agente_id: ag.id, tipo: 'tela' });
  await painel.esperar((m) => m.tipo === 'relay' && m.dados.e === 'aberta' && m.dados.ref === 'r1');

  const comando = await agente.esperar((m) => m.t === 'cmd' && m.tipo === 'tela.notificar');
  assert.equal(comando.args.usuario, 'admin');
  const linha = db.prepare("SELECT * FROM comandos WHERE tipo = 'tela.notificar'").get();
  assert.ok(linha, 'fica registrado na tabela comandos, igual qualquer outro comando tipado');

  agente.ws.close();
  await app.close();
});

test('tela: só 1 sessão por dispositivo ao mesmo tempo (maxPorAgente)', async () => {
  const { app, db, base } = await subir();
  const { c } = await adminElevado(app, db);
  const ag = await registrarAgente(app, c);
  await ag.checkin(metricas());
  const agente = agenteFalso(base, ag);
  await agente.aberto;

  const painel = conectar(`ws://${base}/api/ws`, { cookie: c.cookie, origin: `http://${base}` });
  await painel.aberto;
  await painel.esperar((m) => m.tipo === 'ola');

  painel.enviar({ t: 'relay.abrir', ref: 'a', agente_id: ag.id, tipo: 'tela' });
  const aberta1 = await painel.esperar((m) => m.tipo === 'relay' && m.dados.e === 'aberta' && m.dados.ref === 'a');
  const sessao1 = aberta1.dados.sessao;

  // segunda tentativa, mesmo agente, enquanto a primeira ainda está aberta: recusada
  painel.enviar({ t: 'relay.abrir', ref: 'b', agente_id: ag.id, tipo: 'tela' });
  const erro = await painel.esperar((m) => m.tipo === 'relay' && m.dados.ref === 'b' && m.dados.e === 'erro');
  assert.match(erro.dados.erro, /já existe uma sessão/i);

  // fecha a primeira; agora uma nova abre normalmente
  painel.enviar({ t: 'relay.fechar', sessao: sessao1 });
  await agente.esperar((m) => m.t === 'relay.fechar' && m.sessao === sessao1);
  await new Promise((r) => setTimeout(r, 50));

  painel.enviar({ t: 'relay.abrir', ref: 'c', agente_id: ag.id, tipo: 'tela' });
  const aberta2 = await painel.esperar((m) => m.tipo === 'relay' && m.dados.e === 'aberta' && m.dados.ref === 'c');
  assert.ok(aberta2.dados.sessao);

  agente.ws.close();
  await app.close();
});
