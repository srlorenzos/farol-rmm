import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';
import { descobrirModulos, ordenarModulos, validarModulo } from '../src/nucleo/modulos.js';
import { aplicarMigracoes, versaoAtual } from '../src/nucleo/migracoes.js';
import { RegistroPermissoes } from '../src/nucleo/permissoes.js';
import { MIGRACOES_NUCLEO } from '../src/nucleo/esquema.js';
import { montarAmbiente, normalizarDefinicoes } from '../src/nucleo/variaveis.js';
import { abrirBanco } from '../src/db.js';
import { criarApp } from '../src/app.js';
import { carregarConfig } from '../src/config.js';
import alertas from '../src/modulos/alertas/index.js';
import jobs from '../src/modulos/jobs/index.js';
import scripts from '../src/modulos/scripts/index.js';
import { novoApp, adminElevado, registrarAgente, cliente, SENHA, metricas } from './ajuda.js';

test('carregador: descobre, valida e ordena módulos (dependências + ordem alfabética)', async () => {
  const pasta = mkdtempSync(join(tmpdir(), 'farol-mod-'));
  const criar = (nome, corpo) => {
    mkdirSync(join(pasta, nome));
    writeFileSync(join(pasta, nome, 'index.js'), `export default ${corpo};`);
  };
  criar('zeta', "{ nome: 'zeta' }");
  criar('beta', "{ nome: 'beta', depende: ['zeta'] }");
  criar('alfa', "{ nome: 'alfa', depende: ['beta'] }");
  criar('gama', "{ nome: 'gama' }");
  mkdirSync(join(pasta, '_rascunho'));
  try {
    const mods = await descobrirModulos(pasta);
    assert.deepEqual(mods.map((m) => m.nome), ['gama', 'zeta', 'beta', 'alfa']);
  } finally { rmSync(pasta, { recursive: true, force: true }); }

  assert.throws(() => ordenarModulos([{ nome: 'a', depende: ['b'] }, { nome: 'b', depende: ['a'] }]), /circular/);
  assert.throws(() => ordenarModulos([{ nome: 'a', depende: ['x'] }]), /não existe/);
  assert.throws(() => validarModulo({ nome: 'a', rotass() {} }, 'a'), /chave desconhecida/);
  assert.throws(() => validarModulo({ nome: 'b' }, 'a'), /igual ao da pasta/);
});

test('carregador: módulos reais do servidor carregam em ordem determinística', async () => {
  const { app, ctx } = await novoApp();
  const ordem = ctx.modulos;
  assert.ok(ordem.indexOf('organizacao') < ordem.indexOf('agentes'));
  assert.ok(ordem.indexOf('agentes') < ordem.indexOf('alertas'));
  assert.ok(ordem.indexOf('scripts') < ordem.indexOf('biblioteca'));
  assert.ok(ordem.indexOf('biblioteca') < ordem.indexOf('jobs'));
  await app.close();
});

test('migrações: versionadas por módulo, idempotentes e transacionais', () => {
  const db = new DatabaseSync(':memory:');
  const migs = ['CREATE TABLE t (a INTEGER)', (d) => d.exec('INSERT INTO t VALUES (1)')];
  assert.equal(aplicarMigracoes(db, 'teste', migs), 2);
  assert.equal(aplicarMigracoes(db, 'teste', migs), 0, 'segunda vez não aplica nada');
  assert.equal(versaoAtual(db, 'teste'), 2);
  // nova migração com erro: nada dela fica no banco
  assert.throws(() => aplicarMigracoes(db, 'teste', [...migs, 'INSERT INTO t VALUES (2); SELECT * FROM nao_existe']), /Migração 3 do módulo "teste"/);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM t').get().n, 1);
  assert.equal(versaoAtual(db, 'teste'), 2);
  // banco mais novo que o código
  assert.throws(() => aplicarMigracoes(db, 'teste', migs.slice(0, 1)), /Atualize o servidor/);
});

test('migrações: banco da v1 é atualizado sem perder dados', async () => {
  const db = abrirBanco(':memory:');
  // Esquema v1 = migração 1 de cada parte (era tudo CREATE TABLE IF NOT EXISTS, sem tabela de controle).
  db.exec(MIGRACOES_NUCLEO[0]);
  db.exec(alertas.migracoes[0]);
  db.exec(jobs.migracoes[0]);
  db.exec(`CREATE TABLE scripts (id INTEGER PRIMARY KEY, nome TEXT NOT NULL, descricao TEXT NOT NULL DEFAULT '', shell TEXT NOT NULL,
    conteudo TEXT NOT NULL, timeout INTEGER NOT NULL DEFAULT 60, criado_em INTEGER NOT NULL, atualizado_em INTEGER NOT NULL)`);
  db.prepare("INSERT INTO config (chave, valor) VALUES ('semeado', 'true')").run();
  db.prepare("INSERT INTO scripts (nome, shell, conteudo, criado_em, atualizado_em) VALUES ('Meu script', 'bash', 'uptime', 1, 1)").run();
  db.prepare("INSERT INTO agentes (id, segredo_hash, hostname, registrado_em) VALUES ('11111111-1111-1111-1111-111111111111', 'x', 'pc-v1', 1)").run();
  db.prepare("INSERT INTO usuarios (usuario, senha_hash, criado_em) VALUES ('admin', 'x', 1)").run();
  assert.ok(scripts.migracoes.length >= 2);

  const config = carregarConfig({ caminhoBanco: ':memory:', tarefasPeriodicas: false });
  const app = await criarApp({ config, db });
  assert.equal(db.prepare("SELECT site_id FROM agentes WHERE hostname = 'pc-v1'").get().site_id, 1);
  assert.equal(db.prepare("SELECT papel FROM usuarios WHERE usuario = 'admin'").get().papel, 'admin');
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM scripts').get().n, 1, 'não semeia de novo');
  assert.equal(db.prepare("SELECT categoria FROM scripts").get().categoria, 'Geral');
  assert.ok(versaoAtual(db, 'nucleo') >= 2);
  await app.close();
});

test('RBAC: registro de permissões e papéis', () => {
  const r = new RegistroPermissoes();
  r.registrar('x', { 'x.ver': { descricao: 'ver', papeis: ['tecnico', 'leitura'] }, 'x.mudar': { descricao: 'mudar', papeis: ['tecnico'] }, 'x.admin': { descricao: 'só admin' } });
  assert.equal(r.papelTem('leitura', 'x.ver'), true);
  assert.equal(r.papelTem('leitura', 'x.mudar'), false);
  assert.equal(r.papelTem('tecnico', 'x.admin'), false);
  assert.equal(r.papelTem('admin', 'x.admin'), true);
  assert.equal(r.papelTem('tecnico', 'nao.declarada'), false);
  assert.deepEqual(r.doPapel('leitura'), ['x.ver']);
  assert.throws(() => r.registrar('y', { 'x.ver': {} }), /duas vezes/);
  assert.throws(() => r.registrar('y', { Invalida: {} }), /inválida/);
  assert.throws(() => r.registrar('y', { 'y.a': { papeis: ['chefe'] } }), /papel desconhecido/);
});

test('RBAC: papéis aplicados nas rotas (leitura não executa nem edita; técnico executa)', async () => {
  const { app, db } = await novoApp();
  const admin = await adminElevado(app, db);
  const ag = await registrarAgente(app, admin.c);
  // admin cria um técnico e um somente-leitura
  for (const [usuario, papel] of [['tec', 'tecnico'], ['leitor', 'leitura']]) {
    const r = await admin.c.post('/api/usuarios', { usuario, senha: SENHA, papel });
    assert.equal(r.status, 200, JSON.stringify(r.json));
  }
  const leitor = cliente(app);
  await leitor.post('/api/login', { usuario: 'leitor', senha: SENHA });
  const est = (await leitor.get('/api/estado')).json;
  assert.equal(est.papel, 'leitura');
  assert.ok(est.permissoes.includes('dispositivos.ver'));
  assert.ok(!est.permissoes.includes('scripts.executar'));
  assert.equal((await leitor.get('/api/agentes')).status, 200);
  assert.equal((await leitor.post('/api/scripts', { nome: 'x', shell: 'bash', conteudo: 'ls' })).status, 403);
  assert.equal((await leitor.post('/api/executar', { agentes: [ag.id], comando: 'ls', shell: 'bash' })).status, 403);
  assert.equal((await leitor.get('/api/usuarios')).status, 403);
  assert.equal((await leitor.get('/api/auditoria')).status, 403);

  const tec = await adminElevado(app, db, { usuario: 'tec2', papel: 'tecnico' });
  assert.equal((await tec.c.post('/api/executar', { agentes: [ag.id], comando: 'ls', shell: 'bash' })).status, 200);
  assert.equal((await tec.c.post(`/api/agentes/${ag.id}/revogar`)).status, 403, 'revogar é só admin');
  const regras = (await tec.c.get('/api/config')).json.regras;
  assert.equal((await tec.c.put('/api/config', { regras })).status, 403);

  // não remove o último admin
  const lista = (await admin.c.get('/api/usuarios')).json;
  const idAdmin = lista.find((u) => u.usuario === 'admin').id;
  assert.equal((await admin.c.put(`/api/usuarios/${idAdmin}`, { papel: 'tecnico' })).status, 409);
  // desativar derruba a sessão
  const idLeitor = lista.find((u) => u.usuario === 'leitor').id;
  assert.equal((await admin.c.put(`/api/usuarios/${idLeitor}`, { ativo: false })).status, 200);
  assert.equal((await leitor.get('/api/agentes')).status, 401);
  assert.equal((await leitor.post('/api/login', { usuario: 'leitor', senha: SENHA })).status, 401);
  await app.close();
});

test('alvos: agente, site, cliente, todos e resolvedor registrado por módulo', async () => {
  const { app, db, ctx } = await novoApp();
  const { c } = await adminElevado(app, db, { elevar: false });
  const cli = (await c.post('/api/clientes', { nome: 'Padaria Sol' })).json;
  const siteSol = db.prepare('SELECT id FROM sites WHERE cliente_id = ?').get(cli.id).id;
  const a1 = await registrarAgente(app, c, { hostname: 'caixa-01', so: 'Windows' }, { site_id: siteSol });
  const a2 = await registrarAgente(app, c, { hostname: 'caixa-02', so: 'Windows' }, { site_id: siteSol });
  const a3 = await registrarAgente(app, c, { hostname: 'matriz-srv', so: 'Linux' });
  const nomes = async (alvo) => (await ctx.alvos.resolver(alvo)).map((a) => a.hostname);
  assert.deepEqual(await nomes({ tipo: 'agente', id: a1.id }), ['caixa-01']);
  assert.deepEqual(await nomes({ tipo: 'site', id: siteSol }), ['caixa-01', 'caixa-02']);
  assert.deepEqual(await nomes({ tipo: 'cliente', id: cli.id }), ['caixa-01', 'caixa-02']);
  assert.deepEqual(await nomes({ tipo: 'todos' }), ['caixa-01', 'caixa-02', 'matriz-srv']);
  assert.deepEqual(await nomes([{ tipo: 'site', id: 1 }, { tipo: 'agente', id: a1.id }]), ['caixa-01', 'matriz-srv'], 'união sem duplicatas');
  await assert.rejects(ctx.alvos.resolver({ tipo: 'grupo', id: 1 }), /desconhecido/);
  ctx.alvos.registrar('grupo', (id) => (id === 7 ? [a2.id, a3.id] : []));
  assert.deepEqual(await nomes({ tipo: 'grupo', id: 7 }), ['caixa-02', 'matriz-srv']);
  // revogado some do alvo
  await c.post(`/api/agentes/${a2.id}/revogar`);
  assert.deepEqual(await nomes({ tipo: 'site', id: siteSol }), ['caixa-01']);
  // escopo na lista de dispositivos e no resumo
  assert.equal((await c.get(`/api/agentes?cliente=${cli.id}`)).json.length, 1);
  assert.equal((await c.get('/api/resumo?site=1')).json.total, 1);
  await app.close();
});

test('executar por alvo, com variáveis em FAROL_* e status de monitor', async () => {
  const { app, db } = await novoApp();
  const { c } = await adminElevado(app, db);
  const ag = await registrarAgente(app, c, { hostname: 'srv', so: 'Linux' });
  await ag.checkin(metricas());
  const r = await c.post('/api/executar', { alvo: { tipo: 'site', id: 1 }, biblioteca_id: 'espaco-disco', variaveis: { LIMITE: 80 } });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  const [job] = (await ag.checkin()).json().jobs;
  assert.deepEqual(job.env, { FAROL_LIMITE: '80', FAROL_NIVEL: 'alerta' });
  assert.ok(!job.conteudo.includes('80'), 'valor não é interpolado no script');
  assert.equal(db.prepare('SELECT env_json FROM jobs WHERE id = ?').get(job.id).env_json, null, 'ambiente apagado após a entrega');
  await ag.resultado({ job_id: job.id, codigo_saida: 0, stdout: 'x\nFAROL_STATUS: critico disco em 97%\n' });
  const j = (await c.get(`/api/jobs/${job.id}`)).json;
  assert.equal(j.monitor_status, 'critico');
  assert.equal(j.monitor_msg, 'disco em 97%');
  // variável inválida
  assert.equal((await c.post('/api/executar', { agentes: [ag.id], biblioteca_id: 'espaco-disco', variaveis: { NIVEL: 'pânico' } })).status, 400);
  assert.equal((await c.post('/api/executar', { agentes: [ag.id], biblioteca_id: 'espaco-disco', variaveis: { OUTRA: 1 } })).status, 400);
  // script Windows num alvo só Linux
  assert.equal((await c.post('/api/executar', { agentes: [ag.id], biblioteca_id: 'limpar-temp' })).status, 400);
  await app.close();
});

test('variáveis: validação e ambiente', () => {
  const defs = normalizarDefinicoes([
    { nome: 'DIAS', tipo: 'numero', padrao: 7 },
    { nome: 'FORCAR', tipo: 'booleano' },
    { nome: 'MODO', tipo: 'selecao', opcoes: ['a', 'b'], obrigatorio: true },
    { nome: 'SENHA', tipo: 'senha', padrao: 'nao-guarda' },
  ]);
  assert.equal(defs[3].padrao, null);
  assert.deepEqual(montarAmbiente(defs, { MODO: 'b', SENHA: 's3' }), { FAROL_DIAS: '7', FAROL_FORCAR: 'false', FAROL_MODO: 'b', FAROL_SENHA: 's3' });
  assert.throws(() => montarAmbiente(defs, {}), /obrigatório/);
  assert.throws(() => montarAmbiente(defs, { MODO: 'a', DIAS: 'muitos' }), /número/);
  assert.throws(() => normalizarDefinicoes([{ nome: 'minusculo' }]), /MAIÚSCULAS/);
  assert.throws(() => normalizarDefinicoes([{ nome: 'X', tipo: 'selecao' }]), /opcoes/);
});
