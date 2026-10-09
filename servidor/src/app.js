// Monta a aplicação: Fastify + segurança, núcleo (ctx), módulos descobertos em src/modulos, WebSockets e painel.
import Fastify from 'fastify';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import websocket from '@fastify/websocket';
import fastifyStatic from '@fastify/static';
import { readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { abrirBanco } from './db.js';
import { carregarConfig } from './config.js';
import { criarContexto, chaveLimiteAgente } from './nucleo/contexto.js';
import { MIGRACOES_NUCLEO } from './nucleo/esquema.js';
import { aplicarMigracoes } from './nucleo/migracoes.js';
import { descobrirModulos } from './nucleo/modulos.js';
import { obterSessao } from './nucleo/sessao.js';

const METODOS_SEGUROS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * @param {object} opcoes
 * @param {object} [opcoes.config]   resultado de carregarConfig()
 * @param {object} [opcoes.db]       banco já aberto (testes usam ':memory:')
 * @param {object|boolean} [opcoes.logger]
 * @param {Array}  [opcoes.modulos]  lista explícita de módulos (padrão: descobrir em config.pastaModulos)
 */
export async function criarApp(opcoes = {}) {
  const config = opcoes.config ?? carregarConfig();
  const db = opcoes.db ?? abrirBanco(config.caminhoBanco);

  const app = Fastify({
    logger: opcoes.logger ?? false,
    trustProxy: config.confiarProxy,
    bodyLimit: 1024 * 1024, // rotas que precisam de mais (check-in com inventário) declaram o próprio limite
  });
  const ctx = criarContexto({ db, config, log: app.log });
  app.decorate('farol', ctx);

  // ---------- Núcleo: migrações próprias ----------
  aplicarMigracoes(db, 'nucleo', MIGRACOES_NUCLEO, ctx);

  // ---------- Segurança HTTP ----------
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
    keyGenerator: (req) => (req.url.startsWith('/api/agente/') ? chaveLimiteAgente(req) : req.ip),
    errorResponseBuilder: (_req, c) => ({ statusCode: 429, erro: `Muitas requisições. Aguarde ${Math.ceil(c.ttl / 1000)} s.` }),
  });

  // CSRF: além do cookie SameSite=Strict, toda mutação do painel precisa do header X-Farol: 1.
  app.addHook('onRequest', async (req, reply) => {
    if (METODOS_SEGUROS.has(req.method)) return;
    if (!req.url.startsWith('/api/') || req.url.startsWith('/api/agente/')) return;
    if (req.headers['x-farol'] !== '1') return reply.code(403).send({ erro: 'Requisição sem header anti-CSRF' });
  });

  app.setErrorHandler((err, req, reply) => {
    if (err.validation) return reply.code(400).send({ erro: 'Dados inválidos', detalhes: err.message });
    if (err.statusCode && err.statusCode < 500) return reply.code(err.statusCode).send({ erro: err.message, ...(err.extra ?? {}) });
    if (err.statusCode === 502 || err.statusCode === 504) return reply.code(err.statusCode).send({ erro: err.message });
    req.log.error(err);
    return reply.code(500).send({ erro: 'Erro interno' });
  });

  await app.register(websocket, { options: { maxPayload: 4 * 1024 * 1024 } });

  // ---------- Módulos ----------
  const modulos = opcoes.modulos ?? await descobrirModulos(config.pastaModulos);
  ctx.modulos = modulos.map((m) => m.nome);
  for (const m of modulos) ctx.permissoes.registrar(m.nome, m.permissoes);
  for (const m of modulos) aplicarMigracoes(db, m.nome, m.migracoes ?? [], ctx);
  for (const m of modulos) {
    if (m.servico) ctx.servicos[m.nome] = m.servico(ctx);
    if (m.aoCheckin) ctx.ganchos.aoCheckin.push({ modulo: m.nome, fn: m.aoCheckin });
    if (m.tarefasAgente) ctx.ganchos.tarefasAgente.push({ modulo: m.nome, fn: m.tarefasAgente });
  }
  for (const m of modulos) {
    if (m.rotas) await app.register(async (escopo) => m.rotas(escopo, ctx), { name: `modulo-${m.nome}` });
  }

  // ---------- WebSocket do painel ----------
  app.get('/api/ws', {
    websocket: true,
    preValidation: async (req, reply) => {
      const origem = req.headers.origin;
      if (origem) {
        let host = null;
        try { host = new URL(origem).host; } catch { /* origem "null" ou malformada */ }
        if (host !== req.headers.host) return reply.code(403).send({ erro: 'Origem não permitida' });
      }
      const sessao = obterSessao(ctx, req);
      if (!sessao) return reply.code(401).send({ erro: 'Sessão inválida' });
      req.sessao = sessao;
    },
  }, (socket, req) => {
    ctx.hubPainel.adicionar(socket, req.sessao, req.ip);
  });

  // ---------- WebSocket do agente ----------
  app.get('/api/agente/ws', {
    websocket: true,
    preValidation: ctx.autenticarAgente,
    config: ctx.limiteAgente(30),
  }, (socket, req) => {
    ctx.canalAgentes.adicionar(req.agente, socket);
  });
  ctx.canalAgentes.aoMensagem('res', (msg, agenteId) => {
    if (Number.isInteger(msg.id)) ctx.comandos.concluir(agenteId, { id: msg.id, ok: !!msg.ok, dados: msg.dados, erro: msg.erro });
  });
  ctx.canalAgentes.aoMensagem('_abriu', (agenteId) => ctx.comandos.entregarFila(agenteId));

  // ---------- Painel: manifesto de módulos + arquivos estáticos ----------
  const pastaModulosPainel = join(config.pastaPainel, 'js', 'modulos');
  app.get('/api/painel/modulos', { preHandler: ctx.exigirLogin }, async () => {
    if (!existsSync(pastaModulosPainel)) return { modulos: [] };
    const nomes = readdirSync(pastaModulosPainel, { withFileTypes: true })
      .filter((d) => d.isDirectory() && !d.name.startsWith('_') && existsSync(join(pastaModulosPainel, d.name, 'index.js')))
      .map((d) => d.name).sort();
    return { modulos: nomes };
  });

  app.get('/api/saude', async () => ({ ok: true, versao: ctx.versao }));

  if (existsSync(config.pastaPainel)) {
    await app.register(fastifyStatic, {
      root: config.pastaPainel, prefix: '/', index: ['index.html'],
      // Documentação (DESIGN.md etc.) fica no repositório, não é servida.
      allowedPath: (caminho) => !/\.(md|map)$/i.test(caminho) && !caminho.split('/').some((p) => p.startsWith('.')),
    });
  }
  app.setNotFoundHandler((req, reply) => {
    if (req.url.startsWith('/api/')) return reply.code(404).send({ erro: 'Rota não encontrada' });
    return reply.code(404).type('text/plain; charset=utf-8').send('Não encontrado');
  });

  // ---------- Tarefas do núcleo ----------
  ctx.agendador.registrar('nucleo.ws-painel', 60_000, () => ctx.hubPainel.revalidar());
  ctx.agendador.registrar('nucleo.ws-agentes', 30_000, () => ctx.canalAgentes.verificarVivos());
  ctx.agendador.registrar('nucleo.comandos', 30_000, (_c, agora) => ctx.comandos.expirar(agora));

  for (const m of modulos) if (m.aoIniciar) await m.aoIniciar(ctx);

  if (config.tarefasPeriodicas) ctx.agendador.iniciar();
  app.addHook('onClose', async () => {
    ctx.agendador.parar();
    for (const c of ctx.hubPainel.conexoes) c.socket.terminate();
    for (const c of ctx.canalAgentes.conexoes.values()) c.socket.terminate();
    if (!opcoes.db) db.close();
  });

  return app;
}

/** Roda todas as tarefas periódicas uma vez com um "agora" simulado (usado nos testes). */
export async function tarefasPeriodicas(ctx, agora = Date.now()) {
  await ctx.agendador.executarTodas(agora);
}
