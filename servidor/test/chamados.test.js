import { test } from 'node:test';
import assert from 'node:assert/strict';
import { novoApp, cliente, adminElevado, registrarAgente, SENHA } from './ajuda.js';

const PNG_1PX = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

/** Chama uma rota /api/agente/chamados/* (sempre POST, como as demais rotas do agente). */
const ag = (app, auth, rota, payload) => app.inject({ method: 'POST', url: `/api/agente/chamados/${rota}`, headers: auth, payload: payload ?? {} });

test('permissões: leitura vê, técnico responde, configurar é só admin', async () => {
  const { app, db } = await novoApp();
  const admin = await adminElevado(app, db);
  const a = await registrarAgente(app, admin.c);
  for (const [usuario, papel] of [['tec', 'tecnico'], ['leitor', 'leitura']]) {
    assert.equal((await admin.c.post('/api/usuarios', { usuario, senha: SENHA, papel })).status, 200);
  }
  const { id } = (await ag(app, a.auth, 'criar', { assunto: 'Impressora não imprime', descricao: 'Nada sai da bandeja' })).json();

  const leitor = cliente(app);
  await leitor.post('/api/login', { usuario: 'leitor', senha: SENHA });
  assert.equal((await leitor.get('/api/chamados')).status, 200);
  assert.equal((await leitor.post(`/api/chamados/${id}/mensagens`, { texto: 'oi' })).status, 403);
  assert.equal((await leitor.put('/api/config/bandeja', { empresa: 'X' })).status, 403);

  const tec = cliente(app);
  await tec.post('/api/login', { usuario: 'tec', senha: SENHA });
  assert.equal((await tec.post(`/api/chamados/${id}/mensagens`, { texto: 'Vamos verificar' })).status, 200);
  assert.equal((await tec.put('/api/config/bandeja', { empresa: 'X' })).status, 403, 'configurar bandeja é só admin');
  assert.equal((await admin.c.put('/api/config/bandeja', { empresa: 'Acme' })).status, 200);
});

test('fluxo completo: abrir (com print) → responder pelo painel → usuário responde → fecha', async () => {
  const { app, db } = await novoApp();
  const admin = await adminElevado(app, db);
  const a = await registrarAgente(app, admin.c, { hostname: 'pc-suporte', so: 'Windows', so_versao: '11', arquitetura: 'AMD64', versao_agente: '2.0.0' });

  const abrir = await ag(app, a.auth, 'criar', {
    assunto: 'PC lento', descricao: 'Trava ao abrir o Excel', categoria: 'desempenho', prioridade: 'alta',
    usuario_windows: 'joao.silva', dados_sistema: { cpu: 80, ram_pct: 90 },
    anexo_base64: PNG_1PX, anexo_tipo: 'image/png', anexo_nome: 'print.png',
  });
  assert.equal(abrir.statusCode, 201);
  const { id } = abrir.json();

  const resumo = (await admin.c.get('/api/chamados/resumo')).json;
  assert.equal(resumo.abertos, 1);
  assert.equal(resumo.urgentes, 0);

  const detalhe = (await admin.c.get(`/api/chamados/${id}`)).json;
  assert.equal(detalhe.status, 'aberto');
  assert.equal(detalhe.mensagens.length, 1);
  assert.equal(detalhe.mensagens[0].autor_tipo, 'usuario');
  assert.equal(detalhe.anexos.length, 1);
  assert.equal(detalhe.dados_sistema.cpu, 80);

  // Painel: baixa o anexo por GET (usado num <img src>); a bandeja baixa pela rota de agente, em base64.
  const anexoResp = await app.inject({ method: 'GET', url: `/api/chamados/${id}/anexos/${detalhe.anexos[0].id}`, headers: { cookie: admin.c.cookie } });
  assert.equal(anexoResp.statusCode, 200);
  assert.ok(anexoResp.rawPayload.length > 0);
  const anexoAgente = (await ag(app, a.auth, 'anexo', { id, anexo_id: detalhe.anexos[0].id })).json();
  assert.equal(anexoAgente.tamanho, anexoResp.rawPayload.length);
  assert.equal(Buffer.from(anexoAgente.conteudo_base64, 'base64').length, anexoResp.rawPayload.length);

  // Técnico assume e responde.
  assert.equal((await admin.c.put(`/api/chamados/${id}`, { status: 'em_andamento', tecnico: 'admin' })).status, 200);
  const resposta = await admin.c.post(`/api/chamados/${id}/mensagens`, { texto: 'Pode reiniciar o PC, por favor?' });
  assert.equal(resposta.status, 200);
  let d2 = (await admin.c.get(`/api/chamados/${id}`)).json;
  assert.equal(d2.status, 'aguardando_usuario');
  assert.equal(d2.mensagens.length, 2);

  // Usuário vê a conversa pela bandeja (API local → API do agente) e responde.
  const listaAgente = (await ag(app, a.auth, 'listar', { usuario: 'joao.silva' })).json();
  assert.equal(listaAgente.length, 1);
  assert.equal(listaAgente[0].ultima_mensagem.autor_tipo, 'tecnico');

  const respUsuario = await ag(app, a.auth, 'responder', { id, texto: 'Já reiniciei, continua lento', usuario_windows: 'joao.silva' });
  assert.equal(respUsuario.statusCode, 200);
  d2 = (await admin.c.get(`/api/chamados/${id}`)).json;
  assert.equal(d2.status, 'em_andamento');
  assert.equal(d2.mensagens.length, 3);

  assert.equal((await admin.c.put(`/api/chamados/${id}`, { status: 'resolvido' })).status, 200);
  const fechar = await ag(app, a.auth, 'fechar', { id });
  assert.equal(fechar.statusCode, 200);
  d2 = (await admin.c.get(`/api/chamados/${id}`)).json;
  assert.equal(d2.status, 'fechado');
  assert.ok(d2.fechado_em);
});

test('anexo maior que 5 MB é recusado', async () => {
  const { app, db } = await novoApp();
  const admin = await adminElevado(app, db);
  const a = await registrarAgente(app, admin.c);
  const grande = Buffer.alloc(5 * 1024 * 1024 + 10).toString('base64');
  const r = await ag(app, a.auth, 'criar', { assunto: 'teste', descricao: 'anexo grande', anexo_base64: grande, anexo_tipo: 'image/png' });
  assert.equal(r.statusCode, 413);
});

test('isolamento: um agente não vê nem acessa chamado de outro', async () => {
  const { app, db } = await novoApp();
  const admin = await adminElevado(app, db);
  const agA = await registrarAgente(app, admin.c, { hostname: 'pc-a', so: 'Windows', so_versao: '11', arquitetura: 'AMD64', versao_agente: '2.0.0' });
  const agB = await registrarAgente(app, admin.c, { hostname: 'pc-b', so: 'Windows', so_versao: '11', arquitetura: 'AMD64', versao_agente: '2.0.0' });

  const { id } = (await ag(app, agA.auth, 'criar', { assunto: 'chamado do A', descricao: 'desc' })).json();

  const listaB = (await ag(app, agB.auth, 'listar')).json();
  assert.equal(listaB.length, 0);

  const verB = await ag(app, agB.auth, 'obter', { id });
  assert.equal(verB.statusCode, 404);

  const responderB = await ag(app, agB.auth, 'responder', { id, texto: 'oi' });
  assert.equal(responderB.statusCode, 404);

  const anexoB = await ag(app, agB.auth, 'anexo', { id, anexo_id: 1 });
  assert.equal(anexoB.statusCode, 404);

  // Mas o painel (técnico) vê os dois.
  const todos = (await admin.c.get('/api/chamados?status=todos')).json;
  assert.equal(todos.length, 1); // só o do A foi criado
});
