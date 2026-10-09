// API do painel (exige sessão): agentes, tokens de instalação, scripts, jobs, alertas, auditoria e configurações.
import { gerarToken, sha256 } from '../seguranca.js';
import { auditar, exigirLogin, exigirElevado } from '../nucleo.js';
import { definirConfig, transacao } from '../db.js';
import { regrasAtuais, webhookAtual, enviarWebhook } from '../alertas.js';

const SHELLS = ['powershell', 'cmd', 'bash', 'python'];
const idAgente = { type: 'string', pattern: '^[0-9a-f-]{36}$' };
const paramsId = { type: 'object', required: ['id'], properties: { id: { type: 'integer', minimum: 1 } } };
const paramsAgente = { type: 'object', required: ['id'], properties: { id: idAgente } };

const scriptSchema = {
  type: 'object', additionalProperties: false, required: ['nome', 'shell', 'conteudo'],
  properties: {
    nome: { type: 'string', minLength: 1, maxLength: 120 },
    descricao: { type: 'string', maxLength: 500 },
    shell: { type: 'string', enum: SHELLS },
    conteudo: { type: 'string', minLength: 1, maxLength: 100_000 },
    timeout: { type: 'integer', minimum: 5, maximum: 3600 },
  },
};

const regraLimite = (comCiclos) => ({
  type: 'object', additionalProperties: false, required: ['ativo', 'limite'],
  properties: {
    ativo: { type: 'boolean' },
    limite: { type: 'number', minimum: 1, maximum: 100 },
    ...(comCiclos ? { ciclos: { type: 'integer', minimum: 1, maximum: 100 } } : {}),
  },
});

const COLUNAS_AGENTE = `a.id, a.hostname, a.so, a.so_versao, a.arquitetura, a.versao_agente, a.ip_local, a.usuario_logado,
  a.cpu_pct, a.ram_usada, a.ram_total, a.disco_max_pct, a.uptime, a.status, a.ultimo_checkin, a.registrado_em,
  (SELECT COUNT(*) FROM alertas al WHERE al.agente_id = a.id AND al.status = 'aberto') AS alertas_abertos`;

function urlServidor(ctx, req) {
  return ctx.config.urlPublica || `${req.protocol}://${req.headers.host}`;
}

function ehLocal(url) {
  try {
    const h = new URL(url).hostname;
    return ['localhost', '127.0.0.1', '[::1]', '::1'].includes(h);
  } catch { return false; }
}

export function comandosInstalacao(url, token) {
  const inseguro = url.startsWith('http://') && !ehLocal(url) ? ' --inseguro' : '';
  return {
    windows: `Invoke-WebRequest -UseBasicParsing "${url}/download/farol_agente.py" -OutFile farol_agente.py; `
      + `python -m pip install psutil; python farol_agente.py instalar --servidor "${url}" --token "${token}"${inseguro}`,
    linux: `curl -fsSLO "${url}/download/farol_agente.py" && `
      + `sudo python3 farol_agente.py instalar --servidor "${url}" --token "${token}"${inseguro}`,
  };
}

export default async function rotasPainel(app, ctx) {
  const { db, hub } = ctx;
  const autenticado = exigirLogin(ctx);
  const elevado = exigirElevado();
  app.addHook('preHandler', autenticado);
  const quem = (req) => req.sessao.usuario;

  // ---------- Visão geral ----------
  app.get('/api/resumo', async () => {
    const c = db.prepare(`SELECT COUNT(*) AS total,
        SUM(status = 'online') AS online, SUM(status <> 'online') AS offline
      FROM agentes WHERE revogado = 0`).get();
    const alertas = db.prepare("SELECT COUNT(*) AS n FROM alertas WHERE status = 'aberto'").get().n;
    const piores = db.prepare(`SELECT ${COLUNAS_AGENTE},
        MAX(COALESCE(a.cpu_pct, 0), COALESCE(a.ram_usada * 100.0 / NULLIF(a.ram_total, 0), 0), COALESCE(a.disco_max_pct, 0)) AS pior
      FROM agentes a WHERE a.revogado = 0 AND a.status = 'online' ORDER BY pior DESC LIMIT 5`).all();
    const execucoes = db.prepare(`SELECT j.id, j.nome, j.status, j.criado_em, j.concluido_em, j.criado_por, j.codigo_saida,
        a.hostname, a.id AS agente_id
      FROM jobs j JOIN agentes a ON a.id = j.agente_id ORDER BY j.id DESC LIMIT 8`).all();
    return { total: c.total || 0, online: c.online || 0, offline: c.offline || 0, alertasAbertos: alertas, piores, execucoes };
  });

  // ---------- Agentes ----------
  app.get('/api/agentes', async () => {
    return db.prepare(`SELECT ${COLUNAS_AGENTE} FROM agentes a WHERE a.revogado = 0 ORDER BY a.hostname COLLATE NOCASE`).all();
  });

  app.get('/api/agentes/:id', { schema: { params: paramsAgente } }, async (req, reply) => {
    const a = db.prepare(`SELECT ${COLUNAS_AGENTE}, a.discos_json, a.inventario_json, a.inventario_em, a.revogado
      FROM agentes a WHERE a.id = ?`).get(req.params.id);
    if (!a) return reply.code(404).send({ erro: 'Agente não encontrado' });
    const { discos_json, inventario_json, ...resto } = a;
    return { ...resto, discos: JSON.parse(discos_json || '[]'), inventario: inventario_json ? JSON.parse(inventario_json) : null };
  });

  app.get('/api/agentes/:id/metricas', {
    schema: { params: paramsAgente, querystring: { type: 'object', properties: { horas: { type: 'integer', minimum: 1, maximum: 168, default: 24 } } } },
  }, async (req) => {
    const horas = req.query.horas;
    const balde = horas <= 1 ? 60_000 : horas <= 24 ? 300_000 : 1_800_000;
    const desde = Date.now() - horas * 3600_000;
    const pontos = db.prepare(`SELECT (ts / ?) * ? AS t, AVG(cpu) AS cpu, AVG(ram_pct) AS ram, AVG(disco_pct) AS disco
      FROM metricas WHERE agente_id = ? AND ts >= ? GROUP BY ts / ? ORDER BY t`)
      .all(balde, balde, req.params.id, desde, balde);
    return { horas, baldeMs: balde, desde, pontos };
  });

  app.get('/api/agentes/:id/jobs', { schema: { params: paramsAgente } }, async (req) => {
    return db.prepare(`SELECT id, nome, shell, status, criado_por, criado_em, enviado_em, concluido_em, codigo_saida, duracao_ms
      FROM jobs WHERE agente_id = ? ORDER BY id DESC LIMIT 50`).all(req.params.id);
  });

  app.post('/api/agentes/:id/revogar', { schema: { params: paramsAgente } }, async (req, reply) => {
    const a = db.prepare('SELECT id, hostname, revogado FROM agentes WHERE id = ?').get(req.params.id);
    if (!a) return reply.code(404).send({ erro: 'Agente não encontrado' });
    if (a.revogado) return reply.code(409).send({ erro: 'Agente já revogado' });
    transacao(db, () => {
      db.prepare("UPDATE agentes SET revogado = 1, status = 'revogado' WHERE id = ?").run(a.id);
      db.prepare("UPDATE jobs SET status = 'cancelado' WHERE agente_id = ? AND status IN ('pendente', 'enviado')").run(a.id);
      db.prepare("UPDATE alertas SET status = 'resolvido', resolvido_em = ? WHERE agente_id = ? AND status = 'aberto'").run(Date.now(), a.id);
    });
    auditar(db, { usuario: quem(req), acao: 'agente_revogado', alvo: `${a.hostname} (${a.id})`, ip: req.ip });
    hub.emitir('agente', { id: a.id, hostname: a.hostname, status: 'revogado' });
    return { ok: true };
  });

  // ---------- Tokens de instalação ----------
  app.get('/api/tokens-instalacao', async () => {
    return db.prepare(`SELECT t.id, t.descricao, t.criado_por, t.criado_em, t.expira_em, t.usado_em, t.agente_id, a.hostname
      FROM tokens_instalacao t LEFT JOIN agentes a ON a.id = t.agente_id ORDER BY t.id DESC LIMIT 50`).all();
  });

  app.post('/api/tokens-instalacao', {
    schema: { body: { type: 'object', additionalProperties: false, properties: { descricao: { type: 'string', maxLength: 120 } } } },
  }, async (req) => {
    const token = gerarToken();
    const agora = Date.now();
    const expira = agora + 24 * 3600_000;
    const r = db.prepare(`INSERT INTO tokens_instalacao (token_hash, descricao, criado_por, criado_em, expira_em)
      VALUES (?, ?, ?, ?, ?)`).run(sha256(token), req.body?.descricao || null, quem(req), agora, expira);
    auditar(db, { usuario: quem(req), acao: 'token_criado', alvo: `token #${r.lastInsertRowid}`, detalhes: req.body?.descricao || null, ip: req.ip });
    const url = urlServidor(ctx, req);
    return { id: Number(r.lastInsertRowid), token, expira_em: expira, servidor: url, comandos: comandosInstalacao(url, token) };
  });

  app.delete('/api/tokens-instalacao/:id', { schema: { params: paramsId } }, async (req, reply) => {
    const r = db.prepare('DELETE FROM tokens_instalacao WHERE id = ? AND usado_em IS NULL').run(req.params.id);
    if (!r.changes) return reply.code(404).send({ erro: 'Token não encontrado ou já usado' });
    auditar(db, { usuario: quem(req), acao: 'token_revogado', alvo: `token #${req.params.id}`, ip: req.ip });
    return { ok: true };
  });

  // ---------- Scripts ----------
  app.get('/api/scripts', async () => db.prepare('SELECT * FROM scripts ORDER BY nome COLLATE NOCASE').all());

  app.get('/api/scripts/:id', { schema: { params: paramsId } }, async (req, reply) => {
    const s = db.prepare('SELECT * FROM scripts WHERE id = ?').get(req.params.id);
    return s ?? reply.code(404).send({ erro: 'Script não encontrado' });
  });

  app.post('/api/scripts', { schema: { body: scriptSchema } }, async (req) => {
    const b = req.body;
    const agora = Date.now();
    const r = db.prepare(`INSERT INTO scripts (nome, descricao, shell, conteudo, timeout, criado_em, atualizado_em)
      VALUES (?, ?, ?, ?, ?, ?, ?)`).run(b.nome, b.descricao ?? '', b.shell, b.conteudo, b.timeout ?? 60, agora, agora);
    auditar(db, { usuario: quem(req), acao: 'script_criado', alvo: b.nome, ip: req.ip });
    return db.prepare('SELECT * FROM scripts WHERE id = ?').get(r.lastInsertRowid);
  });

  app.put('/api/scripts/:id', { schema: { params: paramsId, body: scriptSchema } }, async (req, reply) => {
    const b = req.body;
    const r = db.prepare(`UPDATE scripts SET nome = ?, descricao = ?, shell = ?, conteudo = ?, timeout = ?, atualizado_em = ?
      WHERE id = ?`).run(b.nome, b.descricao ?? '', b.shell, b.conteudo, b.timeout ?? 60, Date.now(), req.params.id);
    if (!r.changes) return reply.code(404).send({ erro: 'Script não encontrado' });
    auditar(db, { usuario: quem(req), acao: 'script_alterado', alvo: b.nome, ip: req.ip });
    return db.prepare('SELECT * FROM scripts WHERE id = ?').get(req.params.id);
  });

  app.delete('/api/scripts/:id', { schema: { params: paramsId } }, async (req, reply) => {
    const s = db.prepare('SELECT nome FROM scripts WHERE id = ?').get(req.params.id);
    if (!s) return reply.code(404).send({ erro: 'Script não encontrado' });
    db.prepare('DELETE FROM scripts WHERE id = ?').run(req.params.id);
    auditar(db, { usuario: quem(req), acao: 'script_excluido', alvo: s.nome, ip: req.ip });
    return { ok: true };
  });

  // ---------- Execução (exige 2FA + modo elevado) ----------
  app.post('/api/executar', {
    preHandler: elevado,
    schema: { body: {
      type: 'object', additionalProperties: false, required: ['agentes'],
      properties: {
        agentes: { type: 'array', minItems: 1, maxItems: 500, uniqueItems: true, items: idAgente },
        script_id: { type: 'integer', minimum: 1 },
        comando: { type: 'string', minLength: 1, maxLength: 20_000 },
        shell: { type: 'string', enum: SHELLS },
        timeout: { type: 'integer', minimum: 5, maximum: 3600 },
      },
    } },
  }, async (req, reply) => {
    const b = req.body;
    let nome, shell, conteudo, timeout;
    if (b.script_id) {
      const s = db.prepare('SELECT * FROM scripts WHERE id = ?').get(b.script_id);
      if (!s) return reply.code(404).send({ erro: 'Script não encontrado' });
      ({ nome, shell, conteudo } = s);
      timeout = b.timeout ?? s.timeout;
    } else if (b.comando && b.shell) {
      nome = `Comando: ${b.comando.split('\n')[0].slice(0, 60)}`;
      shell = b.shell; conteudo = b.comando; timeout = b.timeout ?? 60;
    } else {
      return reply.code(400).send({ erro: 'Informe script_id ou comando + shell' });
    }
    const marcadores = b.agentes.map(() => '?').join(',');
    const alvos = db.prepare(`SELECT id, hostname FROM agentes WHERE revogado = 0 AND id IN (${marcadores})`).all(...b.agentes);
    if (alvos.length !== b.agentes.length) return reply.code(400).send({ erro: 'Agente inexistente ou revogado na seleção' });
    const agora = Date.now();
    const jobs = transacao(db, () => alvos.map((a) => {
      const r = db.prepare(`INSERT INTO jobs (agente_id, script_id, nome, shell, conteudo, timeout, status, criado_por, criado_em)
        VALUES (?, ?, ?, ?, ?, ?, 'pendente', ?, ?)`).run(a.id, b.script_id ?? null, nome, shell, conteudo, timeout, quem(req), agora);
      return { id: Number(r.lastInsertRowid), agente_id: a.id, hostname: a.hostname };
    }));
    auditar(db, {
      usuario: quem(req), acao: b.script_id ? 'script_executado' : 'comando_executado',
      alvo: alvos.map((a) => a.hostname).join(', '),
      detalhes: { nome, shell, jobs: jobs.map((j) => j.id), ...(b.script_id ? {} : { comando: conteudo.slice(0, 500) }) },
      ip: req.ip,
    });
    for (const j of jobs) hub.emitir('job', { ...j, nome, status: 'pendente', criado_em: agora, criado_por: quem(req) });
    return { jobs };
  });

  app.get('/api/jobs', {
    schema: { querystring: { type: 'object', properties: { limite: { type: 'integer', minimum: 1, maximum: 200, default: 50 } } } },
  }, async (req) => {
    return db.prepare(`SELECT j.id, j.nome, j.shell, j.status, j.criado_por, j.criado_em, j.concluido_em, j.codigo_saida, j.duracao_ms,
        a.hostname, a.id AS agente_id FROM jobs j JOIN agentes a ON a.id = j.agente_id ORDER BY j.id DESC LIMIT ?`).all(req.query.limite);
  });

  app.get('/api/jobs/:id', { schema: { params: paramsId } }, async (req, reply) => {
    const j = db.prepare(`SELECT j.*, a.hostname FROM jobs j JOIN agentes a ON a.id = j.agente_id WHERE j.id = ?`).get(req.params.id);
    return j ?? reply.code(404).send({ erro: 'Job não encontrado' });
  });

  // ---------- Alertas ----------
  app.get('/api/alertas', {
    schema: { querystring: { type: 'object', properties: { status: { type: 'string', enum: ['aberto', 'resolvido', 'todos'], default: 'todos' } } } },
  }, async (req) => {
    const filtro = req.query.status === 'todos' ? '' : 'WHERE al.status = ?';
    const args = req.query.status === 'todos' ? [] : [req.query.status];
    return db.prepare(`SELECT al.*, a.hostname FROM alertas al JOIN agentes a ON a.id = al.agente_id ${filtro}
      ORDER BY (al.status = 'aberto') DESC, al.id DESC LIMIT 300`).all(...args);
  });

  app.post('/api/alertas/:id/resolver', { schema: { params: paramsId } }, async (req, reply) => {
    const r = db.prepare("UPDATE alertas SET status = 'resolvido', resolvido_em = ? WHERE id = ? AND status = 'aberto'").run(Date.now(), req.params.id);
    if (!r.changes) return reply.code(404).send({ erro: 'Alerta não encontrado ou já resolvido' });
    auditar(db, { usuario: quem(req), acao: 'alerta_resolvido', alvo: `alerta #${req.params.id}`, ip: req.ip });
    hub.emitir('alerta', { id: req.params.id, status: 'resolvido' });
    return { ok: true };
  });

  // ---------- Configurações ----------
  app.get('/api/config', async () => ({ regras: regrasAtuais(db), webhook_url: webhookAtual(ctx) }));

  app.put('/api/config', {
    schema: { body: {
      type: 'object', additionalProperties: false, required: ['regras'],
      properties: {
        regras: {
          type: 'object', additionalProperties: false, required: ['cpu', 'ram', 'disco', 'offline'],
          properties: {
            cpu: regraLimite(true), ram: regraLimite(true), disco: regraLimite(false),
            offline: { type: 'object', additionalProperties: false, required: ['ativo', 'minutos'],
              properties: { ativo: { type: 'boolean' }, minutos: { type: 'integer', minimum: 1, maximum: 10_080 } } },
          },
        },
        webhook_url: { type: 'string', maxLength: 500, pattern: '^(https?://\\S+)?$' },
      },
    } },
  }, async (req) => {
    const antes = { regras: regrasAtuais(db), webhook_url: webhookAtual(ctx) };
    definirConfig(db, 'regras', req.body.regras);
    if (req.body.webhook_url !== undefined) definirConfig(db, 'webhook_url', req.body.webhook_url);
    auditar(db, { usuario: quem(req), acao: 'regras_alteradas', alvo: 'alertas', detalhes: { antes, depois: req.body }, ip: req.ip });
    return { regras: regrasAtuais(db), webhook_url: webhookAtual(ctx) };
  });

  app.post('/api/config/webhook-teste', async (req, reply) => {
    const url = webhookAtual(ctx);
    if (!url) return reply.code(400).send({ erro: 'Nenhum webhook configurado' });
    const ok = await enviarWebhook(ctx, { tipo: 'teste', hostname: 'Farol', mensagem: 'Webhook de teste — está funcionando.' }, url);
    auditar(db, { usuario: quem(req), acao: 'webhook_testado', detalhes: ok ? 'ok' : 'falhou', ip: req.ip });
    return ok ? { ok } : reply.code(502).send({ erro: 'O webhook não respondeu com sucesso' });
  });

  // ---------- Auditoria ----------
  app.get('/api/auditoria', {
    schema: { querystring: { type: 'object', properties: {
      acao: { type: 'string', maxLength: 64 }, usuario: { type: 'string', maxLength: 64 },
      q: { type: 'string', maxLength: 120 }, limite: { type: 'integer', minimum: 1, maximum: 1000, default: 200 },
    } } },
  }, async (req) => {
    const onde = [];
    const args = [];
    if (req.query.acao) { onde.push('acao = ?'); args.push(req.query.acao); }
    if (req.query.usuario) { onde.push('usuario = ?'); args.push(req.query.usuario); }
    if (req.query.q) {
      onde.push("(alvo LIKE ? ESCAPE '\\' OR detalhes LIKE ? ESCAPE '\\' OR ip LIKE ? ESCAPE '\\')");
      const like = `%${req.query.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
      args.push(like, like, like);
    }
    const where = onde.length ? `WHERE ${onde.join(' AND ')}` : '';
    const linhas = db.prepare(`SELECT * FROM auditoria ${where} ORDER BY id DESC LIMIT ?`).all(...args, req.query.limite);
    const acoes = db.prepare('SELECT DISTINCT acao FROM auditoria ORDER BY acao').all().map((r) => r.acao);
    const usuarios = db.prepare('SELECT DISTINCT usuario FROM auditoria WHERE usuario IS NOT NULL ORDER BY usuario').all().map((r) => r.usuario);
    return { linhas, acoes, usuarios };
  });
}
