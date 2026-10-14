// Testes do módulo agendamentos: a função cron (puro, sem banco) e as rotas/disparo (com banco em memória).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compilarCron, proximaExecucaoCron, validarCronEProximaExecucao } from '../src/modulos/agendamentos/cron.js';
import { novoApp, cliente, adminElevado, registrarAgente, INFO } from './ajuda.js';

// ---------- cron.js (puro) ----------

test('cron: expressão com número errado de campos é rejeitada', () => {
  assert.throws(() => compilarCron('* * *'), /5 campos/);
});

test('cron: campo fora do intervalo é rejeitado com mensagem clara', () => {
  assert.throws(() => compilarCron('99 * * * *'), /minuto/);
  assert.throws(() => compilarCron('* 24 * * *'), /hora/);
});

test('cron: "0 22 * * 2" bate só às terças 22:00', () => {
  const c = compilarCron('0 22 * * 2');
  // 2026-02-03 é uma terça-feira.
  const terca = new Date(2026, 1, 3, 22, 0, 0, 0).getTime();
  const naoBate = new Date(2026, 1, 3, 22, 1, 0, 0).getTime();
  const prox = proximaExecucaoCron(c, terca - 60_000);
  assert.equal(prox, terca);
  const prox2 = proximaExecucaoCron(c, naoBate);
  // próxima terça às 22h, uma semana depois
  assert.equal(prox2, terca + 7 * 86_400_000);
});

test('cron: "*/15" em minuto gera passos de 15 em 15', () => {
  const c = compilarCron('*/15 * * * *');
  const base = new Date(2026, 0, 1, 10, 3, 0, 0).getTime();
  const prox = proximaExecucaoCron(c, base);
  assert.equal(new Date(prox).getMinutes(), 15);
});

test('cron: expressão impossível (dia 31 em mês sem dia 31 + mês fixo) devolve null', () => {
  // 31 de fevereiro nunca existe.
  const c = compilarCron('0 0 31 2 *');
  assert.equal(proximaExecucaoCron(c, Date.now()), null);
});

test('cron: validarCronEProximaExecucao junta validação e cálculo numa chamada', () => {
  const prox = validarCronEProximaExecucao('0 0 * * *', Date.now());
  assert.ok(prox > Date.now());
  assert.throws(() => validarCronEProximaExecucao('inválido'), /5 campos/);
});

// ---------- módulo (rotas + disparo real via agendador) ----------

async function base() {
  const { app, db, ctx } = await novoApp();
  const { c, segredo } = await adminElevado(app, db);
  const ag = await registrarAgente(app, c, INFO);
  return { app, db, ctx, c, segredo, ag };
}

test('agendamentos: exige login e permissão', async (t) => {
  const { app } = await base();
  t.after(() => app.close());
  const semLogin = cliente(app);
  const r1 = await semLogin.get('/api/agendamentos');
  assert.equal(r1.status, 401);
});

test('agendamentos: criar (tipo intervalo) exige alvo com pelo menos 1 dispositivo', async (t) => {
  const { app, c } = await base();
  t.after(() => app.close());
  const r = await c.post('/api/agendamentos', {
    nome: 'Teste sem alvo', biblioteca_id: 'limpar-temp', tipo: 'intervalo', intervalo_min: 60,
    alvo: { tipo: 'site', id: 999 },
  });
  assert.equal(r.status, 400);
  assert.match(r.json.erro, /nenhum dispositivo/i);
});

test('agendamentos: criar, listar, detalhar e excluir (fluxo CRUD completo)', async (t) => {
  const { app, c, ag } = await base();
  t.after(() => app.close());

  const criar = await c.post('/api/agendamentos', {
    nome: 'Limpeza semanal', biblioteca_id: 'limpar-temp', tipo: 'intervalo', intervalo_min: 60,
    alvo: { tipo: 'agente', id: ag.id },
  });
  assert.equal(criar.status, 201);
  assert.equal(criar.json.nome, 'Limpeza semanal');
  assert.ok(criar.json.ativo);
  assert.ok(criar.json.proxima_execucao > Date.now());
  const id = criar.json.id;

  const lista = await c.get('/api/agendamentos');
  assert.equal(lista.status, 200);
  assert.ok(lista.json.some((a) => a.id === id));

  const detalhe = await c.get(`/api/agendamentos/${id}`);
  assert.equal(detalhe.status, 200);
  assert.deepEqual(detalhe.json.disparos, []);

  const excluir = await c.del(`/api/agendamentos/${id}`);
  assert.equal(excluir.status, 200);
  const depois = await c.get(`/api/agendamentos/${id}`);
  assert.equal(depois.status, 404);
});

test('agendamentos: criar com expressão cron inválida devolve 400', async (t) => {
  const { app, c, ag } = await base();
  t.after(() => app.close());
  const r = await c.post('/api/agendamentos', {
    nome: 'Cron ruim', biblioteca_id: 'limpar-temp', tipo: 'cron', cron: '0 0 31 2 *',
    alvo: { tipo: 'agente', id: ag.id },
  });
  assert.equal(r.status, 400);
});

test('agendamentos: pausar e retomar mudam "ativo" e recalculam a próxima execução', async (t) => {
  const { app, c, ag } = await base();
  t.after(() => app.close());
  const criar = await c.post('/api/agendamentos', {
    nome: 'Pausável', biblioteca_id: 'limpar-temp', tipo: 'intervalo', intervalo_min: 30,
    alvo: { tipo: 'agente', id: ag.id },
  });
  const id = criar.json.id;

  const pausar = await c.post(`/api/agendamentos/${id}/pausar`);
  assert.equal(pausar.status, 200);
  assert.equal((await c.get(`/api/agendamentos/${id}`)).json.ativo, false);

  const antes = Date.now();
  const retomar = await c.post(`/api/agendamentos/${id}/retomar`);
  assert.equal(retomar.status, 200);
  assert.ok(retomar.json.proxima_execucao >= antes);
  assert.equal((await c.get(`/api/agendamentos/${id}`)).json.ativo, true);
});

test('agendamentos: gerenciar sem modo elevado é bloqueado (403, precisaElevar)', async (t) => {
  const { app, db, ag } = await base();
  t.after(() => app.close());
  const { c } = await adminElevado(app, db, { usuario: 'sem-elevar', elevar: false });
  const r = await c.post('/api/agendamentos', {
    nome: 'X', biblioteca_id: 'limpar-temp', tipo: 'intervalo', intervalo_min: 30, alvo: { tipo: 'agente', id: ag.id },
  });
  assert.equal(r.status, 403);
  assert.ok(r.json.precisaElevar);
});

test('agendamentos: disparo real cria job, grava histórico e reagenda a próxima execução', async (t) => {
  const { app, db, ctx, c, ag } = await base();
  t.after(() => app.close());

  const criar = await c.post('/api/agendamentos', {
    nome: 'Dispara já', biblioteca_id: 'limpar-temp', tipo: 'intervalo', intervalo_min: 5,
    alvo: { tipo: 'agente', id: ag.id },
  });
  assert.equal(criar.status, 201);
  const id = criar.json.id;
  const primeiraProxima = criar.json.proxima_execucao;

  // Simula o relógio chegando no horário marcado (sem esperar de verdade).
  const agoraSimulado = primeiraProxima + 1000;
  await ctx.agendador.executar('agendamentos.disparar', agoraSimulado);

  const detalhe = await c.get(`/api/agendamentos/${id}`);
  assert.equal(detalhe.status, 200);
  assert.equal(detalhe.json.disparos.length, 1);
  assert.equal(detalhe.json.disparos[0].erro, null);
  assert.equal(detalhe.json.disparos[0].n_jobs, 1);
  assert.ok(detalhe.json.ultima_execucao >= agoraSimulado);
  // reagendado ~5 min depois do disparo, não do agendamento original (sem acúmulo de atraso)
  assert.ok(detalhe.json.proxima_execucao > agoraSimulado);
  assert.ok(detalhe.json.proxima_execucao < agoraSimulado + 6 * 60_000);

  const jobs = db.prepare('SELECT * FROM jobs WHERE agente_id = ?').all(ag.id);
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].status, 'pendente');

  const auditoria = db.prepare("SELECT * FROM auditoria WHERE acao = 'agendamento_disparado'").all();
  assert.equal(auditoria.length, 1);
  assert.equal(JSON.parse(auditoria[0].detalhes).automatico, true);
});

test('agendamentos: disparo com script incompatível (SO) grava erro no histórico e não trava o agendamento', async (t) => {
  const { app, db, ctx, c, ag } = await base();
  t.after(() => app.close());
  // espaco-disco.sh só roda em linux/macos; o agente de teste é Windows.
  const criar = await c.post('/api/agendamentos', {
    nome: 'Incompatível', biblioteca_id: 'espaco-disco', tipo: 'intervalo', intervalo_min: 5,
    alvo: { tipo: 'agente', id: ag.id },
  });
  assert.equal(criar.status, 201);
  const id = criar.json.id;
  const agoraSimulado = criar.json.proxima_execucao + 1000;
  await ctx.agendador.executar('agendamentos.disparar', agoraSimulado);

  const detalhe = await c.get(`/api/agendamentos/${id}`);
  assert.equal(detalhe.json.disparos.length, 1);
  assert.ok(detalhe.json.disparos[0].erro);
  assert.equal(detalhe.json.disparos[0].n_jobs, 0);
  // continua ativo e reagendado — um script incompatível não deve matar o agendamento pra sempre
  assert.equal(detalhe.json.ativo, true);
  assert.ok(detalhe.json.proxima_execucao > agoraSimulado);

  const jobs = db.prepare('SELECT * FROM jobs WHERE agente_id = ?').all(ag.id);
  assert.equal(jobs.length, 0);
});
