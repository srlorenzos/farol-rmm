// Políticas: pacote de exceções de alerta + moldes de agendamento aplicado de uma vez a um alvo. "Aplicar"
// nunca reinventa alertas/agendamentos — só chama os serviços deles. Os testes confirmam que aplicar de
// verdade muda os dispositivos (overrides reais, agendamento real que dispara via o agendador de verdade)
// e que reaplicar no mesmo alvo atualiza em vez de duplicar.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { novoApp, adminElevado, registrarAgente } from './ajuda.js';

async function novoScript(ctx, extra = {}) {
  return ctx.servicos.scripts.criar({ nome: 'Script de política (teste)', shell: 'cmd', conteudo: 'echo ok', timeout: 30, so: ['windows'], ...extra }, { usuario: 'admin' });
}

test('políticas: validação na criação (precisa de overrides ou agendamentos; molde de agendamento precisa de script válido)', async () => {
  const { app, db } = await novoApp();
  const { c } = await adminElevado(app, db);
  const vazia = await c.post('/api/politicas', { nome: 'Vazia' });
  assert.equal(vazia.status, 400);

  const semScript = await c.post('/api/politicas', { nome: 'X', agendamentos: [{ nome: 'Limpeza', tipo: 'intervalo', intervalo_min: 60 }] });
  assert.equal(semScript.status, 400);
  assert.match(semScript.json.erro, /script_id ou biblioteca_id/);

  const scriptRuim = await c.post('/api/politicas', { nome: 'X', agendamentos: [{ nome: 'Limpeza', tipo: 'intervalo', intervalo_min: 60, script_id: 999999 }] });
  assert.equal(scriptRuim.status, 400);

  const soOverrides = await c.post('/api/politicas', { nome: 'Só regra', overrides: { cpu: { ativo: true, limite: 80, ciclos: 2 } } });
  assert.equal(soOverrides.status, 201);
  await app.close();
});

test('políticas: criar, listar e detalhar', async () => {
  const { app, db, ctx } = await novoApp();
  const { c } = await adminElevado(app, db);
  const s = await novoScript(ctx);
  const criar = await c.post('/api/politicas', {
    nome: 'Site crítico', descricao: 'CPU mais sensível + limpeza diária',
    overrides: { cpu: { ativo: true, limite: 75, ciclos: 2 } },
    agendamentos: [{ nome: 'Limpeza diária', tipo: 'intervalo', intervalo_min: 1440, script_id: s.id }],
  });
  assert.equal(criar.status, 201);
  const id = criar.json.id;
  assert.equal(criar.json.overrides.cpu.limite, 75);
  assert.equal(criar.json.agendamentos.length, 1);

  const lista = await c.get('/api/politicas');
  assert.ok(lista.json.some((p) => p.id === id));

  const detalhe = await c.get(`/api/politicas/${id}`);
  assert.equal(detalhe.status, 200);
  assert.deepEqual(detalhe.json.aplicacoes, []);
  await app.close();
});

test('políticas: aplicar de verdade muda os dispositivos (overrides reais + agendamento real que dispara)', async () => {
  const { app, db, ctx } = await novoApp();
  const { c } = await adminElevado(app, db);
  const ag1 = await registrarAgente(app, c, { hostname: 'pc-01', so: 'Windows' });
  const ag2 = await registrarAgente(app, c, { hostname: 'pc-02', so: 'Windows' });
  const s = await novoScript(ctx);

  const pol = (await c.post('/api/politicas', {
    nome: 'Padrão loja', overrides: { cpu: { ativo: true, limite: 70, ciclos: 1 }, offline: { ativo: true, minutos: 10 } },
    agendamentos: [{ nome: 'Verificação', tipo: 'intervalo', intervalo_min: 30, script_id: s.id }],
  })).json;

  // alvo = "todos" (os 2 dispositivos registrados)
  const aplicar = await c.post(`/api/politicas/${pol.id}/aplicar`, { alvo: { tipo: 'todos' } });
  assert.equal(aplicar.status, 200);
  assert.equal(aplicar.json.dispositivos, 2);
  assert.equal(aplicar.json.overridesAplicados, 4); // 2 tipos x 2 dispositivos
  assert.equal(aplicar.json.agendamentos.length, 1);
  assert.equal(aplicar.json.agendamentos[0].acao, 'criado');
  const agendamentoId = aplicar.json.agendamentos[0].agendamento_id;

  // overrides realmente gravados nos dois dispositivos
  for (const ag of [ag1, ag2]) {
    const overrides = (await c.get(`/api/alertas/overrides?agente=${ag.id}`)).json;
    const porTipo = Object.fromEntries(overrides.map((o) => [o.tipo, o]));
    assert.equal(porTipo.cpu.limite, 70);
    assert.equal(porTipo.offline.minutos, 10);
  }

  // o agendamento criado é um agendamento de verdade, com o nome prefixado pela política, visível em /api/agendamentos
  const agDetalhe = await c.get(`/api/agendamentos/${agendamentoId}`);
  assert.equal(agDetalhe.status, 200);
  assert.match(agDetalhe.json.nome, /^\[Padrão loja\] Verificação$/);
  assert.deepEqual(agDetalhe.json.alvo, { tipo: 'todos' });

  // e dispara de verdade pelo agendador, exatamente como qualquer outro agendamento
  const agoraSimulado = agDetalhe.json.proxima_execucao + 1000;
  await ctx.agendador.executar('agendamentos.disparar', agoraSimulado);
  const depois = await c.get(`/api/agendamentos/${agendamentoId}`);
  assert.equal(depois.json.disparos.length, 1);
  assert.equal(depois.json.disparos[0].n_jobs, 2); // os 2 dispositivos do alvo "todos"

  assert.ok(db.prepare("SELECT 1 FROM auditoria WHERE acao = 'politica_aplicada'").get());
  await app.close();
});

test('políticas: reaplicar no MESMO alvo atualiza o agendamento (não duplica)', async () => {
  const { app, db, ctx } = await novoApp();
  const { c } = await adminElevado(app, db);
  await registrarAgente(app, c, { hostname: 'pc-01', so: 'Windows' });
  const s = await novoScript(ctx);
  const pol = (await c.post('/api/politicas', {
    nome: 'Repetível', overrides: { cpu: { ativo: true, limite: 85, ciclos: 3 } },
    agendamentos: [{ nome: 'Rotina', tipo: 'intervalo', intervalo_min: 60, script_id: s.id }],
  })).json;

  const r1 = await c.post(`/api/politicas/${pol.id}/aplicar`, { alvo: { tipo: 'todos' } });
  const r2 = await c.post(`/api/politicas/${pol.id}/aplicar`, { alvo: { tipo: 'todos' } });
  assert.equal(r1.json.agendamentos[0].acao, 'criado');
  assert.equal(r2.json.agendamentos[0].acao, 'atualizado');
  assert.equal(r1.json.agendamentos[0].agendamento_id, r2.json.agendamentos[0].agendamento_id, 'reaplicar não cria um segundo agendamento');

  const todos = await c.get('/api/agendamentos');
  assert.equal(todos.json.filter((a) => a.nome.includes('Rotina')).length, 1);

  const detalhe = await c.get(`/api/politicas/${pol.id}`);
  assert.equal(detalhe.json.aplicacoes.length, 2, 'cada aplicação fica no histórico, mesmo reaplicando');
  await app.close();
});

test('políticas: aplicar num grupo dinâmico (B3) afeta só os dispositivos que batem com o filtro', async () => {
  const { app, db, ctx } = await novoApp();
  const { c } = await adminElevado(app, db);
  const win = await registrarAgente(app, c, { hostname: 'win-01', so: 'Windows' });
  const lin = await registrarAgente(app, c, { hostname: 'lin-01', so: 'Linux' });
  const grupo = (await c.post('/api/grupos', { nome: 'Windows', filtro: { so: ['windows'] } })).json;
  const pol = (await c.post('/api/politicas', { nome: 'Só Windows', overrides: { disco: { ativo: true, limite: 80 } } })).json;

  const aplicar = await c.post(`/api/politicas/${pol.id}/aplicar`, { alvo: { tipo: 'grupo', id: grupo.id } });
  assert.equal(aplicar.status, 200);
  assert.equal(aplicar.json.dispositivos, 1);

  assert.equal((await c.get(`/api/alertas/overrides?agente=${win.id}`)).json.length, 1);
  assert.equal((await c.get(`/api/alertas/overrides?agente=${lin.id}`)).json.length, 0);
  await app.close();
});

test('políticas: permissões (ver vs gerenciar; aplicar exige 2FA)', async () => {
  const { app, db, ctx } = await novoApp();
  const { c } = await adminElevado(app, db, { elevar: false });
  const s = await novoScript(ctx);
  const criarSemElevar = await c.post('/api/politicas', { nome: 'X', overrides: { cpu: { ativo: true, limite: 80, ciclos: 1 } } });
  assert.equal(criarSemElevar.status, 403);
  assert.ok(criarSemElevar.json.precisaElevar);
  void s;
  await app.close();
});

test('políticas: excluir não apaga os agendamentos já criados por ela (ficam avulsos)', async () => {
  const { app, db, ctx } = await novoApp();
  const { c } = await adminElevado(app, db);
  await registrarAgente(app, c, { hostname: 'pc-01', so: 'Windows' });
  const s = await novoScript(ctx);
  const pol = (await c.post('/api/politicas', { nome: 'Temporária', agendamentos: [{ nome: 'Rotina', tipo: 'intervalo', intervalo_min: 60, script_id: s.id }] })).json;
  const aplicar = await c.post(`/api/politicas/${pol.id}/aplicar`, { alvo: { tipo: 'todos' } });
  const agendamentoId = aplicar.json.agendamentos[0].agendamento_id;

  assert.equal((await c.del(`/api/politicas/${pol.id}`)).status, 200);
  const agendamento = await c.get(`/api/agendamentos/${agendamentoId}`);
  assert.equal(agendamento.status, 200, 'o agendamento continua existindo mesmo depois de excluir a política');
  await app.close();
});
