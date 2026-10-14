// Resposta automática a alerta: quando um alerta ABRE (não a cada atualização de um já aberto), dispara um
// script configurado no próprio dispositivo do alerta, reaproveitando jobs.executar() (nunca duplica a
// entrega). Fogo-e-esquece (igual ao webhook), então os testes fazem polling até o job/auditoria aparecer.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { novoApp, adminElevado, registrarAgente } from './ajuda.js';

async function esperar(fn, { tentativas = 60, intervaloMs = 20 } = {}) {
  for (let i = 0; i < tentativas; i++) {
    const r = fn();
    if (r) return r;
    await new Promise((res) => setTimeout(res, intervaloMs));
  }
  return fn();
}

function jobsDoAgente(db, agenteId) {
  return db.prepare('SELECT * FROM jobs WHERE agente_id = ?').all(agenteId);
}

async function novoScript(ctx, extra = {}) {
  return ctx.servicos.scripts.criar({ nome: 'Resposta de teste', shell: 'cmd', conteudo: 'echo resposta automatica', so: ['windows'], ...extra }, { usuario: 'admin' });
}

function respostasBase(cfg = {}) {
  const r = { ativo: false, script_id: null, biblioteca_id: null, variaveis: {}, timeout: null, limiteMinutos: 0 };
  return { cpu: { ...r }, ram: { ...r }, disco: { ...r }, offline: { ...r }, ...cfg };
}

test('respostas automáticas: PUT exige elevação (2FA)', async () => {
  const { app, db } = await novoApp();
  const { c } = await adminElevado(app, db, { elevar: false });
  const r = await c.put('/api/alertas/respostas', respostasBase());
  assert.equal(r.status, 403);
  assert.ok(r.json.precisaElevar);
  await app.close();
});

test('respostas automáticas: ativar sem script é recusado; script inexistente é recusado', async () => {
  const { app, db } = await novoApp();
  const { c } = await adminElevado(app, db);
  const semScript = await c.put('/api/alertas/respostas', respostasBase({ cpu: { ativo: true, script_id: null, biblioteca_id: null, variaveis: {}, timeout: null, limiteMinutos: 0 } }));
  assert.equal(semScript.status, 400);
  const scriptRuim = await c.put('/api/alertas/respostas', respostasBase({ cpu: { ativo: true, script_id: 999999, biblioteca_id: null, variaveis: {}, timeout: null, limiteMinutos: 0 } }));
  assert.equal(scriptRuim.status, 404);
  await app.close();
});

test('respostas automáticas: salva e aparece no GET', async () => {
  const { app, db, ctx } = await novoApp();
  const { c } = await adminElevado(app, db);
  const s = await novoScript(ctx);
  const corpo = respostasBase({ cpu: { ativo: true, script_id: s.id, biblioteca_id: null, variaveis: {}, timeout: 30, limiteMinutos: 15 } });
  const put = await c.put('/api/alertas/respostas', corpo);
  assert.equal(put.status, 200);
  assert.equal(put.json.cpu.ativo, true);
  assert.equal(put.json.cpu.script_id, s.id);
  const get = (await c.get('/api/alertas/respostas')).json;
  assert.equal(get.cpu.script_id, s.id);
  assert.equal(get.cpu.limiteMinutos, 15);
  assert.equal(get.ram.ativo, false, 'tipos não configurados continuam desligados');
  assert.ok(db.prepare("SELECT 1 FROM auditoria WHERE acao = 'alerta_respostas_alteradas'").get());
  await app.close();
});

test('alerta abrindo dispara o script configurado (job real, criado_por marcado como automático, auditado)', async () => {
  const { app, db, ctx } = await novoApp();
  const { c } = await adminElevado(app, db);
  const ag = await registrarAgente(app, c);
  const s = await novoScript(ctx);
  await c.put('/api/alertas/respostas', respostasBase({ cpu: { ativo: true, script_id: s.id, biblioteca_id: null, variaveis: {}, timeout: null, limiteMinutos: 0 } }));

  const agente = { id: ag.id, hostname: 'pc-teste' };
  ctx.servicos.alertas.abrir(agente, { tipo: 'cpu', mensagem: 'cpu alta', valor: 95, severidade: 'alerta' });

  const jobs = await esperar(() => { const j = jobsDoAgente(db, ag.id); return j.length ? j : null; });
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].script_id, s.id);
  assert.equal(jobs[0].criado_por, 'sistema (resposta a alerta)');

  const auditoria = await esperar(() => db.prepare("SELECT * FROM auditoria WHERE acao = 'alerta_resposta_disparada'").get());
  assert.ok(auditoria);
  const detalhes = JSON.parse(auditoria.detalhes);
  assert.equal(detalhes.tipo, 'cpu');
  assert.equal(detalhes.automatico, true);
  await app.close();
});

test('alerta que continua aberto (atualizações) não dispara o script de novo', async () => {
  const { app, db, ctx } = await novoApp();
  const { c } = await adminElevado(app, db);
  const ag = await registrarAgente(app, c);
  const s = await novoScript(ctx);
  await c.put('/api/alertas/respostas', respostasBase({ cpu: { ativo: true, script_id: s.id, biblioteca_id: null, variaveis: {}, timeout: null, limiteMinutos: 0 } }));
  const agente = { id: ag.id, hostname: 'pc-teste' };

  ctx.servicos.alertas.abrir(agente, { tipo: 'cpu', mensagem: 'cpu alta', valor: 95, severidade: 'alerta' });
  await esperar(() => { const j = jobsDoAgente(db, ag.id); return j.length ? j : null; });
  ctx.servicos.alertas.abrir(agente, { tipo: 'cpu', mensagem: 'cpu ainda mais alta', valor: 99, severidade: 'critico' });
  ctx.servicos.alertas.abrir(agente, { tipo: 'cpu', mensagem: 'cpu ainda mais alta', valor: 99, severidade: 'critico' });
  await new Promise((r) => setTimeout(r, 150));
  assert.equal(jobsDoAgente(db, ag.id).length, 1, 'só a abertura original dispara, não as atualizações do mesmo alerta');
  await app.close();
});

test('limite (flapping): reabrir dentro da janela de limite não dispara de novo; sem limite, dispara', async () => {
  const { app, db, ctx } = await novoApp();
  const { c } = await adminElevado(app, db);
  const ag = await registrarAgente(app, c);
  const s = await novoScript(ctx);
  const agente = { id: ag.id, hostname: 'pc-teste' };

  // com limite de 60 min: abre, resolve, reabre rapidinho -> só 1 disparo
  await c.put('/api/alertas/respostas', respostasBase({ ram: { ativo: true, script_id: s.id, biblioteca_id: null, variaveis: {}, timeout: null, limiteMinutos: 60 } }));
  ctx.servicos.alertas.abrir(agente, { tipo: 'ram', mensagem: 'ram alta', valor: 95 });
  await esperar(() => { const j = jobsDoAgente(db, ag.id); return j.length ? j : null; });
  ctx.servicos.alertas.resolver(agente, 'ram');
  ctx.servicos.alertas.abrir(agente, { tipo: 'ram', mensagem: 'ram alta de novo', valor: 96 });
  await new Promise((r) => setTimeout(r, 150));
  assert.equal(jobsDoAgente(db, ag.id).length, 1, 'ainda dentro da janela de limite: não dispara de novo');

  // sem limite (0): abre, resolve, reabre -> dispara de novo
  await c.put('/api/alertas/respostas', respostasBase({ ram: { ativo: true, script_id: s.id, biblioteca_id: null, variaveis: {}, timeout: null, limiteMinutos: 0 } }));
  ctx.servicos.alertas.resolver(agente, 'ram');
  ctx.servicos.alertas.abrir(agente, { tipo: 'ram', mensagem: 'ram alta mais uma vez', valor: 97 });
  const jobs2 = await esperar(() => { const j = jobsDoAgente(db, ag.id); return j.length >= 2 ? j : null; });
  assert.equal(jobs2.length, 2, 'sem janela de limite, uma nova abertura dispara de novo');
  await app.close();
});

test('não dispara resposta automática enquanto o dispositivo está em manutenção', async () => {
  const { app, db, ctx } = await novoApp();
  const { c } = await adminElevado(app, db);
  const ag = await registrarAgente(app, c);
  const s = await novoScript(ctx);
  await c.put('/api/alertas/respostas', respostasBase({ disco: { ativo: true, script_id: s.id, biblioteca_id: null, variaveis: {}, timeout: null, limiteMinutos: 0 } }));
  await c.post('/api/alertas/manutencao', { alvo: { tipo: 'agente', id: ag.id }, duracaoMin: 60 });

  const agente = { id: ag.id, hostname: 'pc-teste' };
  ctx.servicos.alertas.abrir(agente, { tipo: 'disco', mensagem: 'disco cheio', valor: 96 });
  await new Promise((r) => setTimeout(r, 150));
  assert.equal(jobsDoAgente(db, ag.id).length, 0, 'suprimido durante a manutenção, igual ao webhook');
  await app.close();
});

test('script incompatível com o SO do agente: audita falha e não derruba o alerta', async () => {
  const { app, db, ctx } = await novoApp();
  const { c } = await adminElevado(app, db);
  const ag = await registrarAgente(app, c); // agente Windows (INFO padrão de ajuda.js)
  const s = await novoScript(ctx, { shell: 'bash', so: ['linux'] }); // só roda em Linux
  await c.put('/api/alertas/respostas', respostasBase({ offline: { ativo: true, script_id: s.id, biblioteca_id: null, variaveis: {}, timeout: null, limiteMinutos: 0 } }));

  const agente = { id: ag.id, hostname: 'pc-teste' };
  ctx.servicos.alertas.abrir(agente, { tipo: 'offline', mensagem: 'sem check-in', valor: 10, severidade: 'critico' });

  const auditoria = await esperar(() => db.prepare("SELECT * FROM auditoria WHERE acao = 'alerta_resposta_falhou'").get());
  assert.ok(auditoria, 'falha de incompatibilidade é auditada');
  assert.equal(jobsDoAgente(db, ag.id).length, 0);
  // o alerta em si continua normal, não é afetado pela falha da resposta
  assert.equal((await c.get(`/api/alertas?status=aberto&agente=${ag.id}`)).json.length, 1);
  await app.close();
});
