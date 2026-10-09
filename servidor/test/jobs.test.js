import { test } from 'node:test';
import assert from 'node:assert/strict';
import { novoApp, adminElevado, registrarAgente, codigoAtual } from './ajuda.js';
import { tarefasPeriodicas } from '../src/app.js';

test('executar exige 2FA ativo e modo elevado', async () => {
  const { app, db } = await novoApp();
  const { c, segredo } = await adminElevado(app, db, { elevar: false });
  const ag = await registrarAgente(app, c);
  const pedido = { agentes: [ag.id], comando: 'echo ola', shell: 'cmd' };

  const sem = await c.post('/api/executar', pedido);
  assert.equal(sem.status, 403);
  assert.equal(sem.json.precisaElevar, true);

  assert.equal((await c.post('/api/elevar', { codigo: '000000' })).status, 401);
  assert.equal((await c.post('/api/elevar', { codigo: codigoAtual(segredo, 1) })).status, 200);
  assert.equal((await c.post('/api/executar', pedido)).status, 200);

  // modo elevado expira
  db.prepare('UPDATE sessoes SET elevado_ate = ?').run(Date.now() - 1);
  assert.equal((await c.post('/api/executar', pedido)).status, 403);
  await app.close();
});

test('sem 2FA ativo não é possível executar nem elevar', async () => {
  const { app, db } = await novoApp();
  const { criarUsuario } = await import('../src/rotas/auth.js');
  const { cliente, SENHA } = await import('./ajuda.js');
  await criarUsuario(db, 'admin', SENHA);
  const c = cliente(app);
  await c.post('/api/login', { usuario: 'admin', senha: SENHA });
  const ag = await registrarAgente(app, c);
  const r = await c.post('/api/executar', { agentes: [ag.id], comando: 'whoami', shell: 'cmd' });
  assert.equal(r.status, 403);
  assert.equal(r.json.precisa2fa, true);
  assert.equal((await c.post('/api/elevar', { codigo: '123456' })).status, 403);
  await app.close();
});

test('job: criação → entrega no check-in → resultado', async () => {
  const { app, db } = await novoApp();
  const { c } = await adminElevado(app, db);
  const a1 = await registrarAgente(app, c);
  const a2 = await registrarAgente(app, c, { hostname: 'srv-linux', so: 'Linux' });
  const script = (await c.get('/api/scripts')).json.find((s) => s.shell === 'cmd');
  assert.ok(script, 'scripts de exemplo semeados');

  const exec = await c.post('/api/executar', { agentes: [a1.id, a2.id], script_id: script.id });
  assert.equal(exec.status, 200);
  assert.equal(exec.json.jobs.length, 2);

  const ck = (await a1.checkin()).json();
  assert.equal(ck.jobs.length, 1);
  assert.equal(ck.jobs[0].conteudo, script.conteudo);
  assert.equal(ck.jobs[0].shell, 'cmd');
  // não entrega de novo
  assert.equal((await a1.checkin()).json().jobs.length, 0);

  const jobId = ck.jobs[0].id;
  // outro agente não pode reportar o job
  assert.equal((await a2.resultado({ job_id: jobId, codigo_saida: 0, stdout: 'x' })).statusCode, 404);
  const res = await a1.resultado({ job_id: jobId, codigo_saida: 0, stdout: 'ola\n', stderr: '', duracao_ms: 42 });
  assert.equal(res.statusCode, 200);
  assert.equal((await a1.resultado({ job_id: jobId, codigo_saida: 0 })).statusCode, 409);

  const job = (await c.get(`/api/jobs/${jobId}`)).json;
  assert.equal(job.status, 'sucesso');
  assert.equal(job.stdout, 'ola\n');
  assert.equal(job.duracao_ms, 42);

  const aud = db.prepare("SELECT * FROM auditoria WHERE acao = 'script_executado'").get();
  assert.equal(aud.usuario, 'admin');
  assert.match(aud.alvo, /pc-teste/);
  await app.close();
});

test('comando rápido, falha, timeout e expiração', async () => {
  const { app, db, ctx } = await novoApp();
  const { c } = await adminElevado(app, db);
  const ag = await registrarAgente(app, c);
  await c.post('/api/executar', { agentes: [ag.id], comando: 'exit 3', shell: 'bash', timeout: 10 });
  await c.post('/api/executar', { agentes: [ag.id], comando: 'sleep 99', shell: 'bash', timeout: 5 });
  await c.post('/api/executar', { agentes: [ag.id], comando: 'esquecido', shell: 'bash', timeout: 5 });
  const [j1, j2, j3] = (await ag.checkin()).json().jobs;
  await ag.resultado({ job_id: j1.id, codigo_saida: 3, stdout: '', stderr: 'erro' });
  await ag.resultado({ job_id: j2.id, codigo_saida: null, timeout: true, erro: 'tempo limite de 5 s excedido' });
  assert.equal((await c.get(`/api/jobs/${j1.id}`)).json.status, 'falha');
  const t = (await c.get(`/api/jobs/${j2.id}`)).json;
  assert.equal(t.status, 'timeout');
  assert.match(t.stderr, /tempo limite/);
  tarefasPeriodicas(ctx, Date.now() + 5_000 + 121_000);
  assert.equal((await c.get(`/api/jobs/${j3.id}`)).json.status, 'expirado');
  assert.ok(db.prepare("SELECT 1 FROM auditoria WHERE acao = 'comando_executado'").get());
  await app.close();
});

test('saída é truncada em 64 KB no servidor', async () => {
  const { app, db } = await novoApp();
  const { c } = await adminElevado(app, db);
  const ag = await registrarAgente(app, c);
  await c.post('/api/executar', { agentes: [ag.id], comando: 'x', shell: 'bash' });
  const [j] = (await ag.checkin()).json().jobs;
  await ag.resultado({ job_id: j.id, codigo_saida: 0, stdout: 'a'.repeat(65 * 1024) });
  const job = (await c.get(`/api/jobs/${j.id}`)).json;
  assert.ok(job.stdout.length < 65 * 1024);
  assert.match(job.stdout, /truncada/);
  await app.close();
});

test('CRUD de scripts com validação e auditoria', async () => {
  const { app, db } = await novoApp();
  const { c } = await adminElevado(app, db, { elevar: false });
  assert.equal((await c.post('/api/scripts', { nome: 'x', shell: 'zsh', conteudo: 'ls' })).status, 400);
  const novo = await c.post('/api/scripts', { nome: 'Uptime', shell: 'bash', conteudo: 'uptime', timeout: 10 });
  assert.equal(novo.status, 200);
  const alt = await c.put(`/api/scripts/${novo.json.id}`, { nome: 'Uptime 2', shell: 'bash', conteudo: 'uptime -p' });
  assert.equal(alt.json.nome, 'Uptime 2');
  assert.equal((await c.del(`/api/scripts/${novo.json.id}`)).status, 200);
  assert.equal((await c.get(`/api/scripts/${novo.json.id}`)).status, 404);
  const acoes = db.prepare('SELECT acao FROM auditoria').all().map((r) => r.acao);
  for (const a of ['script_criado', 'script_alterado', 'script_excluido']) assert.ok(acoes.includes(a), a);
  await app.close();
});
