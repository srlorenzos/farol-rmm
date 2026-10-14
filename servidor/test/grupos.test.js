// Grupos dinâmicos (por filtro, nunca por lista de membros) e campos personalizados (UDFs) + tags por
// dispositivo. O ponto central: um grupo é resolvido de novo a cada uso, então um dispositivo que passa a
// bater com o filtro aparece sozinho, sem precisar editar o grupo — testado explicitamente abaixo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { novoApp, adminElevado, registrarAgente, cliente } from './ajuda.js';

test('grupos: CRUD básico e validação', async () => {
  const { app, db } = await novoApp();
  const { c } = await adminElevado(app, db, { elevar: false });
  const semNome = await c.post('/api/grupos', { filtro: { so: ['windows'] } });
  assert.equal(semNome.status, 400);

  const criar = await c.post('/api/grupos', { nome: 'Windows', filtro: { so: ['windows'] } });
  assert.equal(criar.status, 201);
  const id = criar.json.id;
  assert.equal(criar.json.total, 0, 'nenhum dispositivo ainda');

  const listar = await c.get('/api/grupos');
  assert.equal(listar.status, 200);
  assert.ok(listar.json.some((g) => g.id === id));

  const detalhe = await c.get(`/api/grupos/${id}`);
  assert.equal(detalhe.status, 200);
  assert.deepEqual(detalhe.json.filtro, { so: ['windows'] });

  const editar = await c.put(`/api/grupos/${id}`, { nome: 'Windows (editado)' });
  assert.equal(editar.status, 200);
  assert.equal(editar.json.nome, 'Windows (editado)');

  const excluir = await c.del(`/api/grupos/${id}`);
  assert.equal(excluir.status, 200);
  assert.equal((await c.get(`/api/grupos/${id}`)).status, 404);
  await app.close();
});

test('grupos: filtro por SO', async () => {
  const { app, db, ctx } = await novoApp();
  const { c } = await adminElevado(app, db, { elevar: false });
  await registrarAgente(app, c, { hostname: 'win-01', so: 'Windows' });
  await registrarAgente(app, c, { hostname: 'lin-01', so: 'Linux' });
  const g = (await c.post('/api/grupos', { nome: 'Windows', filtro: { so: ['windows'] } })).json;
  assert.equal(g.total, 1);
  const r = await ctx.alvos.resolver({ tipo: 'grupo', id: g.id });
  assert.deepEqual(r.map((a) => a.hostname), ['win-01']);
  await app.close();
});

test('grupos: filtro por site e por cliente', async () => {
  const { app, db } = await novoApp();
  const { c } = await adminElevado(app, db, { elevar: false });
  const cli = (await c.post('/api/clientes', { nome: 'Padaria Sol' })).json;
  const siteSol = db.prepare('SELECT id FROM sites WHERE cliente_id = ?').get(cli.id).id;
  await registrarAgente(app, c, { hostname: 'caixa-01', so: 'Windows' }, { site_id: siteSol });
  await registrarAgente(app, c, { hostname: 'matriz-srv', so: 'Linux' });

  const porSite = (await c.post('/api/grupos', { nome: 'Site Sol', filtro: { site_id: siteSol } })).json;
  assert.equal(porSite.total, 1);
  const porCliente = (await c.post('/api/grupos', { nome: 'Cliente Sol', filtro: { cliente_id: cli.id } })).json;
  assert.equal(porCliente.total, 1);
  await app.close();
});

test('grupos: filtro por nome contém', async () => {
  const { app, db } = await novoApp();
  const { c } = await adminElevado(app, db, { elevar: false });
  await registrarAgente(app, c, { hostname: 'srv-financeiro-01', so: 'Windows' });
  await registrarAgente(app, c, { hostname: 'srv-rh-01', so: 'Windows' });
  const g = (await c.post('/api/grupos', { nome: 'Financeiro', filtro: { nome_contem: 'financeiro' } })).json;
  assert.equal(g.total, 1);
  const detalhe = await c.get(`/api/grupos/${g.id}`);
  assert.equal(detalhe.json.agentes[0].hostname, 'srv-financeiro-01');
  await app.close();
});

test('grupos: filtro por tag', async () => {
  const { app, db } = await novoApp();
  const { c } = await adminElevado(app, db, { elevar: false });
  const a1 = await registrarAgente(app, c, { hostname: 'caixa-01', so: 'Windows' });
  await registrarAgente(app, c, { hostname: 'caixa-02', so: 'Windows' });
  const putTags = await c.put(`/api/agentes/${a1.id}/tags`, { tags: ['critico', 'pdv'] });
  assert.equal(putTags.status, 200);
  assert.deepEqual((await c.get(`/api/agentes/${a1.id}/tags`)).json.sort(), ['critico', 'pdv']);
  assert.deepEqual((await c.get('/api/tags')).json.sort(), ['critico', 'pdv']);

  const g = (await c.post('/api/grupos', { nome: 'Críticos', filtro: { tag: 'critico' } })).json;
  assert.equal(g.total, 1);
  await app.close();
});

test('campos personalizados (UDF): criar, validar, valor por dispositivo, filtrar grupo por campo', async () => {
  const { app, db } = await novoApp();
  const { c } = await adminElevado(app, db, { elevar: false });
  const a1 = await registrarAgente(app, c, { hostname: 'pc-01', so: 'Windows' });
  await registrarAgente(app, c, { hostname: 'pc-02', so: 'Windows' });

  const semOpcoes = await c.post('/api/campos', { nome: 'Centro de custo', tipo: 'selecao' });
  assert.equal(semOpcoes.status, 400);

  const campo = (await c.post('/api/campos', { nome: 'Centro de custo', tipo: 'selecao', opcoes: ['TI', 'Financeiro'] })).json;
  assert.equal(campo.chave, 'centro-de-custo');

  const semValor = await c.get(`/api/agentes/${a1.id}/campos`);
  assert.equal(semValor.json[0].valor, null);

  const salvar = await c.put(`/api/agentes/${a1.id}/campos`, { valores: { [campo.id]: 'TI' } });
  assert.equal(salvar.status, 200);
  const comValor = await c.get(`/api/agentes/${a1.id}/campos`);
  assert.equal(comValor.json[0].valor, 'TI');

  const g = (await c.post('/api/grupos', { nome: 'TI', filtro: { campo: { campo_id: campo.id, operador: 'igual', valor: 'TI' } } })).json;
  assert.equal(g.total, 1);

  // apagar o campo remove os valores (cascade) sem quebrar nada
  assert.equal((await c.del(`/api/campos/${campo.id}`)).status, 200);
  assert.equal((await c.get(`/api/agentes/${a1.id}/campos`)).json.length, 0);
  await app.close();
});

test('grupos são DINÂMICOS: um dispositivo novo que bate com o filtro aparece sozinho, sem editar o grupo', async () => {
  const { app, db, ctx } = await novoApp();
  const { c } = await adminElevado(app, db, { elevar: false });
  await registrarAgente(app, c, { hostname: 'win-existente', so: 'Windows' });
  const g = (await c.post('/api/grupos', { nome: 'Windows', filtro: { so: ['windows'] } })).json;
  assert.equal(g.total, 1);

  // registra um dispositivo Windows NOVO depois do grupo já criado — nenhuma chamada de API no grupo em si.
  await registrarAgente(app, c, { hostname: 'win-novo', so: 'Windows' });

  const depois = await c.get(`/api/grupos/${g.id}`);
  assert.equal(depois.json.total, 2, 'o grupo já reflete o novo dispositivo sem precisar editar nada');
  assert.deepEqual(depois.json.agentes.map((a) => a.hostname).sort(), ['win-existente', 'win-novo']);

  const resolvido = await ctx.alvos.resolver({ tipo: 'grupo', id: g.id });
  assert.deepEqual(resolvido.map((a) => a.hostname).sort(), ['win-existente', 'win-novo']);
  await app.close();
});

test('grupo dinâmico funciona como alvo de execução de verdade (POST /api/executar)', async () => {
  const { app, db } = await novoApp();
  const { c } = await adminElevado(app, db);
  const win = await registrarAgente(app, c, { hostname: 'win-01', so: 'Windows' });
  await registrarAgente(app, c, { hostname: 'lin-01', so: 'Linux' });
  const g = (await c.post('/api/grupos', { nome: 'Windows', filtro: { so: ['windows'] } })).json;

  const exec = await c.post('/api/executar', { alvo: { tipo: 'grupo', id: g.id }, comando: 'echo oi', shell: 'cmd' });
  assert.equal(exec.status, 200);
  assert.equal(exec.json.jobs.length, 1);
  assert.equal(exec.json.jobs[0].agente_id, win.id);
  await app.close();
});

test('grupos: permissões (ver vs gerenciar) e campos (gerenciar vs editar)', async () => {
  const { app, db } = await novoApp();
  const { c: admin } = await adminElevado(app, db);
  const r = await admin.post('/api/usuarios', { usuario: 'leitor', senha: 'Senha-Forte-123', papel: 'leitura' });
  assert.equal(r.status, 200);
  const leitor = cliente(app);
  await leitor.post('/api/login', { usuario: 'leitor', senha: 'Senha-Forte-123' });

  assert.equal((await leitor.get('/api/grupos')).status, 200);
  assert.equal((await leitor.post('/api/grupos', { nome: 'X', filtro: {} })).status, 403);
  assert.equal((await leitor.post('/api/campos', { nome: 'X', tipo: 'texto' })).status, 403);
  await app.close();
});
