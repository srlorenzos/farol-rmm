// Monta a aplicação Fastify: segurança, rotas, painel estático e WebSocket.
import Fastify from 'fastify';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import websocket from '@fastify/websocket';
import fastifyStatic from '@fastify/static';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { abrirBanco } from './db.js';
import { carregarConfig, RAIZ_SERVIDOR } from './config.js';
import { HubTempoReal, obterSessao } from './nucleo.js';
import { verificarOffline } from './alertas.js';
import rotasAuth from './rotas/auth.js';
import rotasAgenteApi from './rotas/agente-api.js';
import rotasPainel from './rotas/painel.js';

const PASTA_PAINEL = resolve(RAIZ_SERVIDOR, '..', 'painel');
const ARQUIVO_AGENTE = resolve(RAIZ_SERVIDOR, '..', 'agente', 'farol_agente.py');
const METODOS_SEGUROS = new Set(['GET', 'HEAD', 'OPTIONS']);

export async function criarApp(opcoes = {}) {
  const config = opcoes.config ?? carregarConfig();
  const db = opcoes.db ?? abrirBanco(config.caminhoBanco);
  const hub = new HubTempoReal();

  const app = Fastify({
    logger: opcoes.logger ?? false,
    trustProxy: config.confiarProxy,
    bodyLimit: 8 * 1024 * 1024, // inventário com milhares de softwares
  });
  const ctx = { db, config, hub, log: app.log };
  app.decorate('farol', ctx);

  await app.register(helmet, {
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'none'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        ...(config.https ? { upgradeInsecureRequests: [] } : {}),
      },
    },
    strictTransportSecurity: config.https ? { maxAge: 31_536_000, includeSubDomains: true } : false,
    crossOriginEmbedderPolicy: false,
    referrerPolicy: { policy: 'no-referrer' },
  });

  await app.register(rateLimit, {
    global: true,
    max: config.limites.global,
    timeWindow: '1 minute',
    errorResponseBuilder: (_req, c) => ({ statusCode: 429, erro: `Muitas requisições. Aguarde ${Math.ceil(c.ttl / 1000)} s.` }),
  });

  // CSRF: além do cookie SameSite=Strict, toda mutação do painel precisa do header X-Farol: 1.
  // Formulários HTML de outros sites não conseguem enviar headers customizados sem CORS (que não habilitamos).
  app.addHook('onRequest', async (req, reply) => {
    if (METODOS_SEGUROS.has(req.method)) return;
    if (!req.url.startsWith('/api/') || req.url.startsWith('/api/agente/')) return;
    if (req.headers['x-farol'] !== '1') return reply.code(403).send({ erro: 'Requisição sem header anti-CSRF' });
  });

  app.setErrorHandler((err, req, reply) => {
    if (err.validation) return reply.code(400).send({ erro: 'Dados inválidos', detalhes: err.message });
    if (err.statusCode && err.statusCode < 500) return reply.code(err.statusCode).send({ erro: err.message });
    req.log.error(err);
    return reply.code(500).send({ erro: 'Erro interno' });
  });

  await app.register(websocket, { options: { maxPayload: 4096 } });

  await app.register(async (r) => rotasAuth(r, ctx));
  await app.register(async (r) => rotasAgenteApi(r, ctx));
  await app.register(async (r) => rotasPainel(r, ctx));

  app.get('/api/ws', {
    websocket: true,
    preValidation: async (req, reply) => {
      const origem = req.headers.origin;
      if (origem && new URL(origem).host !== req.headers.host) return reply.code(403).send({ erro: 'Origem não permitida' });
      if (!obterSessao(ctx, req)) return reply.code(401).send({ erro: 'Sessão inválida' });
    },
  }, (socket) => {
    hub.adicionar(socket);
    socket.send(JSON.stringify({ tipo: 'ola', ts: Date.now() }));
    socket.on('message', () => {}); // o painel não envia comandos pelo socket
  });

  app.get('/download/farol_agente.py', async (_req, reply) => {
    const codigo = await readFile(ARQUIVO_AGENTE, 'utf8');
    return reply.type('text/x-python; charset=utf-8')
      .header('content-disposition', 'attachment; filename="farol_agente.py"').send(codigo);
  });

  app.get('/api/saude', async () => ({ ok: true }));

  await app.register(fastifyStatic, { root: PASTA_PAINEL, prefix: '/', index: ['index.html'] });
  app.setNotFoundHandler((req, reply) => {
    if (req.url.startsWith('/api/')) return reply.code(404).send({ erro: 'Rota não encontrada' });
    return reply.code(404).type('text/plain; charset=utf-8').send('Não encontrado');
  });

  // Tarefas periódicas: offline, jobs expirados, limpeza de histórico.
  const tarefas = [];
  if (config.tarefasPeriodicas) {
    tarefas.push(setInterval(() => tarefasPeriodicas(ctx), 10_000));
    tarefas.push(setInterval(() => limpeza(ctx), 3600_000));
    limpeza(ctx);
  }
  app.addHook('onClose', async () => {
    tarefas.forEach(clearInterval);
    if (!opcoes.db) db.close();
  });

  return app;
}

export function tarefasPeriodicas(ctx, agora = Date.now()) {
  try {
    verificarOffline(ctx, agora);
    // Job enviado que não voltou dentro do timeout + 2 min de folga é marcado como expirado.
    const expirados = ctx.db.prepare(`SELECT id, agente_id FROM jobs
      WHERE status = 'enviado' AND enviado_em + (timeout * 1000) + 120000 < ?`).all(agora);
    for (const j of expirados) {
      ctx.db.prepare("UPDATE jobs SET status = 'expirado', concluido_em = ? WHERE id = ?").run(agora, j.id);
      ctx.hub.emitir('job', { id: j.id, agente_id: j.agente_id, status: 'expirado' });
    }
  } catch (e) {
    ctx.log?.error?.(e);
  }
}

export function limpeza(ctx, agora = Date.now()) {
  const semana = agora - 7 * 24 * 3600_000;
  ctx.db.prepare('DELETE FROM metricas WHERE ts < ?').run(semana);
  ctx.db.prepare('DELETE FROM sessoes WHERE expira_em < ?').run(agora);
  ctx.db.prepare('DELETE FROM tokens_instalacao WHERE usado_em IS NULL AND expira_em < ?').run(agora - 7 * 24 * 3600_000);
}
