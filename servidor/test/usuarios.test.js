// Convites e redefinição de senha (módulo usuarios): link de uso único, sem e-mail de verdade.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { novoApp, adminElevado, cliente, SENHA } from './ajuda.js';

function tokenDoLink(link) {
  return new URL(link).searchParams.get('token');
}

test('convite: cria usuário sem senha, aceitar define a senha e permite logar', async () => {
  const { app, db } = await novoApp();
  const { c } = await adminElevado(app, db);

  const r = await c.post('/api/usuarios/convidar', { usuario: 'tecnico1', papel: 'tecnico', nome: 'Téc Um' });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal(r.json.usuario.papel, 'tecnico');
  assert.ok(r.json.link.includes('/convite.html?token='));
  const token = tokenDoLink(r.json.link);

  // consulta pública do convite
  const info = await c.get(`/api/convites/${token}`);
  assert.equal(info.status, 200);
  assert.equal(info.json.usuario, 'tecnico1');
  assert.equal(info.json.tipo, 'convite');

  // login ainda não é possível (senha aleatória desconhecida)
  const anon = cliente(app);
  const falhou = await anon.post('/api/login', { usuario: 'tecnico1', senha: 'qualquer-coisa-123' });
  assert.equal(falhou.status, 401);

  // senha fraca é recusada
  const fraca = await anon.post(`/api/convites/${token}`, { senha: '123' });
  assert.equal(fraca.status, 400);

  // aceita o convite
  const aceitar = await anon.post(`/api/convites/${token}`, { senha: 'Senha-Forte-Nova-1' });
  assert.equal(aceitar.status, 200);
  assert.equal(aceitar.json.usuario, 'tecnico1');

  // agora loga
  const login = await anon.post('/api/login', { usuario: 'tecnico1', senha: 'Senha-Forte-Nova-1' });
  assert.equal(login.status, 200);

  // o token já usado não serve de novo
  const reuso = await anon.post(`/api/convites/${token}`, { senha: 'Outra-Senha-Forte-2' });
  assert.equal(reuso.status, 410);
});

test('convite: usuário duplicado é recusado; só admin convida; exige elevação', async () => {
  const { app, db } = await novoApp();
  const { c } = await adminElevado(app, db);
  await c.post('/api/usuarios/convidar', { usuario: 'dup', papel: 'leitura' });
  const r = await c.post('/api/usuarios/convidar', { usuario: 'dup', papel: 'leitura' });
  assert.equal(r.status, 409);

  // técnico não pode convidar
  const t = await adminElevado(app, db, { usuario: 'tec', papel: 'tecnico' });
  const negado = await t.c.post('/api/usuarios/convidar', { usuario: 'outro', papel: 'leitura' });
  assert.equal(negado.status, 403);

  // sem modo elevado (2FA confirmado) é recusado mesmo para admin
  const { c: c2 } = await adminElevado(app, db, { usuario: 'admin2', elevar: false });
  const semElevar = await c2.post('/api/usuarios/convidar', { usuario: 'outro2', papel: 'leitura' });
  assert.equal(semElevar.status, 403);
  assert.equal(semElevar.json.precisaElevar, true);
});

test('redefinição: admin gera link para usuário existente; invalida link anterior; auditado', async () => {
  const { app, db } = await novoApp();
  const { c } = await adminElevado(app, db);
  const conv = await c.post('/api/usuarios/convidar', { usuario: 'user2', papel: 'leitura' });
  const idUsuario = conv.json.usuario.id;

  const r1 = await c.post(`/api/usuarios/${idUsuario}/redefinir`);
  assert.equal(r1.status, 200);
  const token1 = tokenDoLink(r1.json.link);

  const r2 = await c.post(`/api/usuarios/${idUsuario}/redefinir`);
  const token2 = tokenDoLink(r2.json.link);
  assert.notEqual(token1, token2);

  const anon = cliente(app);
  // o primeiro link foi invalidado pelo segundo pedido
  const velho = await anon.get(`/api/convites/${token1}`);
  assert.equal(velho.status, 410);
  const novo = await anon.get(`/api/convites/${token2}`);
  assert.equal(novo.status, 200);
  assert.equal(novo.json.tipo, 'redefinicao');

  const acoes = db.prepare("SELECT acao FROM auditoria WHERE acao = 'redefinicao_solicitada'").all();
  assert.equal(acoes.length, 2);

  // usuário inexistente
  const r404 = await c.post('/api/usuarios/999999/redefinir');
  assert.equal(r404.status, 404);
});

test('token inválido ou de outro formato é recusado com erro genérico', async () => {
  const { app, db } = await novoApp();
  await adminElevado(app, db);
  const anon = cliente(app);
  const r = await anon.get('/api/convites/token-que-nao-existe-00000000000');
  assert.equal(r.status, 410);
});
