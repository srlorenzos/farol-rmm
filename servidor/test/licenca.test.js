import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { assinar, verificar, situacao, LIMITE_GRATIS } from '../src/modulos/licenca/chave.js';
import { novoApp, adminElevado, registrarAgente } from './ajuda.js';

const par = generateKeyPairSync('ed25519');
const privada = par.privateKey.export({ type: 'pkcs8', format: 'pem' });
const publica = par.publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
const DIA = 86_400_000;
const base = { id: 'abc', cliente: 'Acme', email: 'a@acme.com', plano: 'profissional', dispositivos_max: 10 };

test('assinatura válida é aceita e devolve o conteúdo', () => {
  const r = verificar(assinar(base, privada), { chavePublica: publica });
  assert.equal(r.ok, true);
  assert.equal(r.licenca.cliente, 'Acme');
  assert.equal(r.licenca.dispositivos_max, 10);
});

test('chave de outro par, adulterada ou malformada é recusada', () => {
  const outra = generateKeyPairSync('ed25519').privateKey.export({ type: 'pkcs8', format: 'pem' });
  assert.equal(verificar(assinar(base, outra), { chavePublica: publica }).ok, false);
  const boa = assinar(base, privada);
  const [p, s] = boa.slice(6).split('.');
  const payload = JSON.parse(Buffer.from(p, 'base64url'));
  payload.dispositivos_max = 9999;
  const adulterada = `FAROL-${Buffer.from(JSON.stringify(payload)).toString('base64url')}.${s}`;
  assert.equal(verificar(adulterada, { chavePublica: publica }).ok, false);
  assert.equal(verificar('lixo').ok, false);
  assert.equal(verificar('FAROL-abc').ok, false);
  assert.equal(verificar('FAROL-a.b.c').ok, false);
  assert.equal(verificar(boa).ok, false, 'a chave pública embutida não é a do teste');
});

test('validade, aviso de 15 dias, carência de 7 dias e expirada', () => {
  const agora = 1_800_000_000_000;
  const l = (exp) => ({ ...base, expira_em: exp });
  assert.equal(situacao(null).limite, LIMITE_GRATIS);
  assert.equal(situacao(l(agora + 60 * DIA), agora).aviso_expiracao, false);
  const perto = situacao(l(agora + 10 * DIA), agora);
  assert.equal(perto.estado, 'ativa');
  assert.equal(perto.aviso_expiracao, true);
  assert.equal(perto.dias_restantes, 10);
  const car = situacao(l(agora - 3 * DIA), agora);
  assert.equal(car.estado, 'carencia');
  assert.equal(car.limite, 10);
  const exp = situacao(l(agora - 8 * DIA), agora);
  assert.equal(exp.estado, 'expirada');
  assert.equal(exp.limite, LIMITE_GRATIS);
  assert.equal(situacao({ ...base, expira_em: null }, agora).estado, 'ativa');
  assert.equal(situacao({ ...base, dispositivos_max: 0, expira_em: null }, agora).ilimitado, true);
});

test('limite grátis de 5 dispositivos, mensagem clara e liberação por licença', async () => {
  const { app, db } = await novoApp({ licencaChavePublica: publica });
  const { c } = await adminElevado(app, db);
  for (let i = 0; i < LIMITE_GRATIS; i++) await registrarAgente(app, c, { hostname: `pc-${i}` });
  const tentar = async () => {
    const { json: tk } = await c.post('/api/tokens-instalacao', { descricao: 'extra' });
    return app.inject({ method: 'POST', url: '/api/agente/registrar', payload: { token: tk.token, info: { hostname: 'pc-extra' } } });
  };
  const r = await tentar();
  assert.equal(r.statusCode, 402);
  assert.match(r.json().erro, /Limite de 5 dispositivos/);
  const est = (await c.get('/api/licenca')).json;
  assert.equal(est.usados, 5);
  assert.equal(est.estado, 'gratis');
  assert.equal(est.perto_do_limite, true);

  assert.equal((await c.put('/api/licenca', { chave: 'FAROL-lixo.lixo-lixo-lixo-lixo' })).status, 400);
  const ok = await c.put('/api/licenca', { chave: assinar({ ...base, dispositivos_max: 6, expira_em: Date.now() + 90 * DIA }, privada) });
  assert.equal(ok.status, 200);
  assert.equal(ok.json.estado, 'ativa');
  assert.equal(ok.json.limite, 6);
  assert.equal((await tentar()).statusCode, 200);
  const r2 = await tentar();
  assert.equal(r2.statusCode, 402);
  assert.match(r2.json().erro, /da licença atingido/);

  // expirada além da carência volta ao limite grátis; dentro da carência segue valendo
  const e = (await c.put('/api/licenca', { chave: assinar({ ...base, dispositivos_max: 50, expira_em: Date.now() - 3 * DIA }, privada) })).json;
  assert.equal(e.estado, 'carencia');
  assert.equal(e.limite, 50);
  const f = (await c.put('/api/licenca', { chave: assinar({ ...base, dispositivos_max: 50, expira_em: Date.now() - 9 * DIA }, privada) })).json;
  assert.equal(f.estado, 'expirada');
  assert.equal(f.limite, LIMITE_GRATIS);
  assert.equal((await tentar()).statusCode, 402);

  // ilimitada
  const g = (await c.put('/api/licenca', { chave: assinar({ ...base, dispositivos_max: 0, expira_em: null }, privada) })).json;
  assert.equal(g.ilimitado, true);
  assert.equal((await tentar()).statusCode, 200);
  assert.equal((await c.del('/api/licenca')).json.estado, 'gratis');
});

test('leitura não instala licença', async () => {
  const { app, db } = await novoApp({ licencaChavePublica: publica });
  const { c } = await adminElevado(app, db, { usuario: 'leitor', papel: 'leitura', elevar: false });
  assert.equal((await c.get('/api/licenca')).status, 200);
  assert.equal((await c.put('/api/licenca', { chave: assinar(base, privada) })).status, 403);
});
