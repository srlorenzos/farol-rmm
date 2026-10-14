// Downsampling do histórico de métricas: agregação em camadas (15 min / 1 h / 1 dia) a partir do dado
// cru, poda que nunca apaga o que uma camada ainda não processou, e a rota de histórico escolhendo a
// granularidade certa pelo período pedido.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { novoApp, adminElevado, registrarAgente } from './ajuda.js';
import { lerConfig, definirConfig } from '../src/db.js';

const MIN = 60_000, HORA = 3_600_000, DIA = 86_400_000;

/** Insere pontos crus diretamente (ignora o limite de 1/min do check-in: controla os timestamps à mão). */
function inserirPontos(db, agenteId, pontos) {
  const q = db.prepare('INSERT INTO metricas (agente_id, ts, cpu, ram_pct, disco_pct) VALUES (?, ?, ?, ?, ?)');
  for (const p of pontos) q.run(agenteId, p.ts, p.cpu ?? null, p.ram ?? null, p.disco ?? null);
}

test('agregação: balde de 15 min calcula min/max/média/p95 corretos e avança o watermark', async () => {
  const { app, db, ctx } = await novoApp();
  const { c } = await adminElevado(app, db, { elevar: false });
  const ag = await registrarAgente(app, c);

  const agora = Date.now();
  const inicioBalde = Math.floor((agora - 3 * HORA) / (15 * MIN)) * (15 * MIN); // balde bem fechado, há horas
  const cpus = [10, 20, 30, 40, 100]; // p95 "nearest rank" de 5 valores = o 5º (maior) => 100
  inserirPontos(db, ag.id, cpus.map((cpu, i) => ({ ts: inicioBalde + i * MIN, cpu, ram: cpu + 1, disco: cpu + 2 })));

  await ctx.agendador.executar('agentes.metricas_agregar', agora);

  const linha = db.prepare('SELECT * FROM metricas_15m WHERE agente_id = ? AND ts = ?').get(ag.id, inicioBalde);
  assert.ok(linha, 'balde deveria ter sido agregado');
  assert.equal(linha.n, 5);
  assert.equal(linha.cpu_min, 10);
  assert.equal(linha.cpu_max, 100);
  assert.equal(linha.cpu_avg, 40); // (10+20+30+40+100)/5
  assert.equal(linha.cpu_p95, 100);
  assert.equal(linha.ram_min, 11);
  assert.equal(linha.disco_max, 102);

  const marca = lerConfig(db, 'metricas_marca_15m', 0);
  assert.ok(marca > inicioBalde, 'watermark avança pra depois do balde processado');
  await app.close();
});

test('agregação: camadas de 1 h e 1 dia também são preenchidas a partir do mesmo dado cru', async () => {
  const { app, db, ctx } = await novoApp();
  const { c } = await adminElevado(app, db, { elevar: false });
  const ag = await registrarAgente(app, c);

  // 30h atrás: margem de sobra pra garantir que tanto o balde de hora quanto o de DIA já estejam
  // fechados não importa a hora do dia em que o teste rodar (achar "5h atrás" quase sempre funciona,
  // mas falha sempre que o teste roda de madrugada em UTC e "5h atrás" cai ainda dentro de hoje).
  const agora = Date.now();
  const inicioHora = Math.floor((agora - 30 * HORA) / HORA) * HORA;
  const inicioDia = Math.floor((agora - 30 * HORA) / DIA) * DIA;
  inserirPontos(db, ag.id, [0, 10, 20, 30].map((i) => ({ ts: inicioHora + i * MIN, cpu: 50, ram: 60, disco: 70 })));

  await ctx.agendador.executar('agentes.metricas_agregar', agora);

  const h = db.prepare('SELECT * FROM metricas_1h WHERE agente_id = ? AND ts = ?').get(ag.id, inicioHora);
  assert.ok(h, 'balde de 1 hora deveria existir');
  assert.equal(h.cpu_avg, 50);

  const d = db.prepare('SELECT * FROM metricas_1d WHERE agente_id = ? AND ts = ?').get(ag.id, inicioDia);
  assert.ok(d, 'balde do dia deveria existir');
  assert.equal(d.cpu_avg, 50);
  await app.close();
});

test('agregação: reprocessar o mesmo balde substitui a linha (idempotente), não duplica', async () => {
  const { app, db, ctx } = await novoApp();
  const { c } = await adminElevado(app, db, { elevar: false });
  const ag = await registrarAgente(app, c);
  const agora = Date.now();
  const inicioBalde = Math.floor((agora - 3 * HORA) / (15 * MIN)) * (15 * MIN);
  inserirPontos(db, ag.id, [{ ts: inicioBalde, cpu: 10, ram: 10, disco: 10 }]);
  await ctx.agendador.executar('agentes.metricas_agregar', agora);
  // acrescenta outro ponto no MESMO balde e força o watermark de volta: reprocessa e atualiza em vez de duplicar.
  inserirPontos(db, ag.id, [{ ts: inicioBalde + MIN, cpu: 30, ram: 30, disco: 30 }]);
  definirConfig(db, 'metricas_marca_15m', inicioBalde);
  await ctx.agendador.executar('agentes.metricas_agregar', agora);
  const linhas = db.prepare('SELECT * FROM metricas_15m WHERE agente_id = ? AND ts = ?').all(ag.id, inicioBalde);
  assert.equal(linhas.length, 1, 'uma linha só por (agente, balde) — ON CONFLICT atualiza');
  assert.equal(linhas[0].cpu_avg, 20); // média de 10 e 30
  assert.equal(linhas[0].n, 2);
  await app.close();
});

test('poda: preserva dado cru que nenhuma camada processou ainda, mesmo passado da retenção fina', async () => {
  const { app, db, ctx } = await novoApp();
  const { c } = await adminElevado(app, db, { elevar: false });
  const ag = await registrarAgente(app, c);
  const agora = Date.now();
  const tsAntigo = agora - 40 * DIA; // bem além das 48 h de retenção fina padrão
  inserirPontos(db, ag.id, [{ ts: tsAntigo, cpu: 5, ram: 5, disco: 5 }]);

  // só a limpeza, SEM agregar antes — o watermark de cada camada está em 0 (nunca rodou).
  await ctx.agendador.executar('agentes.limpeza', agora);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM metricas WHERE agente_id = ?').get(ag.id).n, 1,
    'dado cru não processado por nenhuma camada não pode ser apagado');

  // agora agrega (as 3 camadas processam o balde antigo) e roda a limpeza de novo.
  await ctx.agendador.executar('agentes.metricas_agregar', agora);
  for (const tabela of ['metricas_15m', 'metricas_1h', 'metricas_1d']) {
    assert.equal(db.prepare(`SELECT COUNT(*) AS n FROM ${tabela} WHERE agente_id = ?`).get(ag.id).n, 1, `${tabela} deveria ter o balde`);
  }
  await ctx.agendador.executar('agentes.limpeza', agora);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM metricas WHERE agente_id = ?').get(ag.id).n, 0,
    'depois de agregado e passado da retenção fina, o cru pode ser removido');
  await app.close();
});

test('poda: cada camada agregada respeita sua própria retenção (15 min/14 d, hora/90 d, dia/365 d)', async () => {
  const { app, db, ctx } = await novoApp();
  const { c } = await adminElevado(app, db, { elevar: false });
  const ag = await registrarAgente(app, c);
  const agora = Date.now();

  const inserirAgregado = (tabela, ts) => db.prepare(`INSERT INTO ${tabela}
      (agente_id, ts, n, cpu_min, cpu_max, cpu_avg, cpu_p95, ram_min, ram_max, ram_avg, ram_p95, disco_min, disco_max, disco_avg, disco_p95)
      VALUES (?, ?, 1, 1,1,1,1, 1,1,1,1, 1,1,1,1)`).run(ag.id, ts);

  const velho15m = agora - 20 * DIA, novo15m = agora - 1 * DIA;
  const velho1h = agora - 100 * DIA, novo1h = agora - 1 * DIA;
  const velho1d = agora - 400 * DIA, novo1d = agora - 1 * DIA;
  inserirAgregado('metricas_15m', velho15m); inserirAgregado('metricas_15m', novo15m);
  inserirAgregado('metricas_1h', velho1h); inserirAgregado('metricas_1h', novo1h);
  inserirAgregado('metricas_1d', velho1d); inserirAgregado('metricas_1d', novo1d);

  await ctx.agendador.executar('agentes.limpeza', agora);

  const restantes = (tabela) => db.prepare(`SELECT ts FROM ${tabela} WHERE agente_id = ? ORDER BY ts`).all(ag.id).map((r) => r.ts);
  assert.deepEqual(restantes('metricas_15m'), [novo15m], 'balde de 15 min além de 14 dias é removido');
  assert.deepEqual(restantes('metricas_1h'), [novo1h], 'balde de 1 h além de 90 dias é removido');
  assert.deepEqual(restantes('metricas_1d'), [novo1d], 'balde de 1 dia além de 365 dias é removido');
  await app.close();
});

test('rota de histórico escolhe a granularidade certa pelo período pedido', async () => {
  const { app, db, ctx } = await novoApp();
  const { c } = await adminElevado(app, db, { elevar: false });
  const ag = await registrarAgente(app, c);
  const agora = Date.now();

  // dado bruto recente (dentro da retenção fina) pra 1h/24h.
  inserirPontos(db, ag.id, [{ ts: agora - 5 * MIN, cpu: 42, ram: 50, disco: 60 }]);
  let r = await c.get(`/api/agentes/${ag.id}/metricas?horas=1`);
  assert.equal(r.status, 200);
  assert.equal(r.json.granularidade, 'bruto');
  assert.equal(r.json.baldeMs, 60_000);

  r = await c.get(`/api/agentes/${ag.id}/metricas?horas=24`);
  assert.equal(r.json.granularidade, 'bruto');
  assert.equal(r.json.baldeMs, 300_000);

  r = await c.get(`/api/agentes/${ag.id}/metricas?horas=72`); // > 48h: camada de 15 min
  assert.equal(r.json.granularidade, '15m');
  assert.equal(r.json.baldeMs, 15 * MIN);

  r = await c.get(`/api/agentes/${ag.id}/metricas?horas=400`); // > 14 dias: camada de 1 h
  assert.equal(r.json.granularidade, '1h');
  assert.equal(r.json.baldeMs, HORA);

  r = await c.get(`/api/agentes/${ag.id}/metricas?horas=3000`); // > 90 dias: camada de 1 dia
  assert.equal(r.json.granularidade, '1d');
  assert.equal(r.json.baldeMs, DIA);

  // 365 dias (máximo aceito pelo schema) não dá erro de validação.
  r = await c.get(`/api/agentes/${ag.id}/metricas?horas=8760`);
  assert.equal(r.status, 200);
  r = await c.get(`/api/agentes/${ag.id}/metricas?horas=8761`);
  assert.equal(r.status, 400);
  await app.close();
});

test('rota de histórico: período agregado devolve min/max/p95 junto da média', async () => {
  const { app, db, ctx } = await novoApp();
  const { c } = await adminElevado(app, db, { elevar: false });
  const ag = await registrarAgente(app, c);
  const agora = Date.now();
  const inicioBalde = Math.floor((agora - 72 * HORA) / (15 * MIN)) * (15 * MIN);
  db.prepare(`INSERT INTO metricas_15m (agente_id, ts, n, cpu_min, cpu_max, cpu_avg, cpu_p95, ram_min, ram_max, ram_avg, ram_p95, disco_min, disco_max, disco_avg, disco_p95)
    VALUES (?, ?, 10, 5, 95, 50, 90, 6, 96, 51, 91, 7, 97, 52, 92)`).run(ag.id, inicioBalde);

  const r = await c.get(`/api/agentes/${ag.id}/metricas?horas=96`);
  assert.equal(r.status, 200);
  const ponto = r.json.pontos.find((p) => p.t === inicioBalde);
  assert.ok(ponto, 'balde inserido deveria aparecer nos pontos');
  assert.equal(ponto.cpu, 50);
  assert.equal(ponto.cpu_min, 5);
  assert.equal(ponto.cpu_max, 95);
  assert.equal(ponto.cpu_p95, 90);
  void ctx;
  await app.close();
});
