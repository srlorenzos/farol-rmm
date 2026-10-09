// Dispositivos (agentes): registro, check-in, métricas, inventário, tokens de instalação, ações de energia
// e o download do pacote do agente. As tabelas são do núcleo; este módulo é a API.
//
// Pipeline do check-in (POST /api/agente/checkin):
//   1. atualiza métricas/inventário/capacidades   2. amostra histórico (1/min)
//   3. ganchos aoCheckin de todos os módulos       4. resposta = { intervalo, pedirInventario, comandos, tempoReal }
//      + o que os ganchos tarefasAgente devolverem (ex.: { jobs: [...] } do módulo jobs).
import { randomUUID } from 'node:crypto';
import { gerarToken, sha256 } from '../../seguranca.js';
import { transacao } from '../../db.js';
import { PARAMS_ID, PARAMS_AGENTE, filtroEscopo, ESCOPO_QUERY } from '../../nucleo/util.js';
import { pacoteAgente } from './pacote.js';

const INTERVALO_AMOSTRA = 60_000; // no máx. 1 ponto de histórico por minuto por agente
const INVENTARIO_VALIDADE = 3600_000;
const RESERVADAS = new Set(['intervalo', 'pedirInventario', 'comandos', 'tempoReal']);

const txt = (max) => ({ type: 'string', maxLength: max });
const num = { type: 'number' };

const infoSchema = {
  type: 'object', additionalProperties: false,
  required: ['hostname'],
  properties: {
    hostname: { type: 'string', minLength: 1, maxLength: 255 },
    so: txt(64), so_versao: txt(255), arquitetura: txt(64), versao_agente: txt(32),
    capacidades: { type: 'array', maxItems: 300, items: txt(80) },
  },
};

const metricasSchema = {
  type: 'object', additionalProperties: false,
  properties: {
    cpu: { type: 'number', minimum: 0, maximum: 100 },
    ram_usada: num, ram_total: num,
    uptime: num,
    usuario: { type: ['string', 'null'], maxLength: 255 },
    ip: { type: ['string', 'null'], maxLength: 64 },
    discos: {
      type: 'array', maxItems: 64,
      items: { type: 'object', additionalProperties: false, properties: {
        ponto: txt(255), fs: txt(64), total: num, usado: num, pct: { type: 'number', minimum: 0, maximum: 100 },
      } },
    },
  },
};

const inventarioSchema = {
  type: 'object',
  properties: {
    sistema: { type: 'object' },
    hardware: { type: 'object' },
    rede: { type: 'array', maxItems: 128 },
    discos: { type: 'array', maxItems: 64 },
    softwares: { type: 'array', maxItems: 5000 },
  },
};

// Colunas da lista de dispositivos (o detalhe acrescenta discos, inventário etc.).
const COLUNAS = `a.id, a.hostname, a.descricao, a.so, a.so_versao, a.arquitetura, a.versao_agente, a.ip_local, a.usuario_logado,
  a.cpu_pct, a.ram_usada, a.ram_total, a.disco_max_pct, a.uptime, a.status, a.ultimo_checkin, a.registrado_em,
  a.site_id, s.nome AS site_nome, s.cliente_id, c.nome AS cliente_nome`;
const FROM = 'FROM agentes a JOIN sites s ON s.id = a.site_id JOIN clientes c ON c.id = s.cliente_id';

function ehLocal(url) {
  try {
    const h = new URL(url).hostname;
    return ['localhost', '127.0.0.1', '[::1]', '::1'].includes(h);
  } catch { return false; }
}

export function comandosInstalacao(url, token) {
  const inseguro = url.startsWith('http://') && !ehLocal(url) ? ' --inseguro' : '';
  return {
    windows: `Invoke-WebRequest -UseBasicParsing "${url}/download/farol-agente.pyz" -OutFile farol-agente.pyz; `
      + `python -m pip install psutil; python farol-agente.pyz instalar --servidor "${url}" --token "${token}"${inseguro}`,
    linux: `curl -fsSLO "${url}/download/farol-agente.pyz" && `
      + `sudo python3 farol-agente.pyz instalar --servidor "${url}" --token "${token}"${inseguro}`,
  };
}

export default {
  nome: 'agentes',
  descricao: 'Dispositivos: registro, check-in, métricas, inventário e instalação',
  depende: ['organizacao'],
  permissoes: {
    'dispositivos.ver': { descricao: 'Ver dispositivos, métricas e inventário', papeis: ['tecnico', 'leitura'] },
    'dispositivos.editar': { descricao: 'Renomear, descrever e mover dispositivos entre sites', papeis: ['tecnico'] },
    'dispositivos.instalar': { descricao: 'Gerar tokens de instalação', papeis: ['tecnico'] },
    'dispositivos.revogar': { descricao: 'Revogar dispositivos' },
    'dispositivos.energia': { descricao: 'Reiniciar e desligar dispositivos', papeis: ['tecnico'] },
  },

  servico(ctx) {
    const enriquecedores = [];
    return {
      /**
       * Outros módulos acrescentam campos às linhas da lista de dispositivos (ex.: alertas_abertos, patch_status).
       * fn(linhas, ctx) altera as linhas no lugar; recebe todas de uma vez para fazer uma consulta só.
       */
      registrarEnriquecedor(nome, fn) { enriquecedores.push({ nome, fn }); },
      enriquecer(linhas) {
        for (const e of enriquecedores) {
          try { e.fn(linhas, ctx); } catch (err) { ctx.log?.error?.({ err, enriquecedor: e.nome }, 'falha ao enriquecer dispositivos'); }
        }
        return linhas;
      },
      colunas: COLUNAS,
      from: FROM,
    };
  },

  rotas(app, ctx) {
    const { db, config } = ctx;
    const ver = ctx.exigir('dispositivos.ver');
    const urlServidor = (req) => config.urlPublica || `${req.protocol}://${req.headers.host}`;

    // =============================== API do agente ===============================
    app.post('/api/agente/registrar', {
      config: { rateLimit: { max: config.limites.registrar, timeWindow: '1 minute' } },
      schema: { body: { type: 'object', required: ['token', 'info'], additionalProperties: false,
        properties: { token: { type: 'string', minLength: 20, maxLength: 128 }, info: infoSchema } } },
    }, async (req, reply) => {
      const agora = Date.now();
      const hash = sha256(req.body.token);
      const resultado = transacao(db, () => {
        const t = db.prepare('SELECT * FROM tokens_instalacao WHERE token_hash = ?').get(hash);
        if (!t) return { erro: 'Token de instalação inválido' };
        if (t.usado_em) return { erro: 'Token de instalação já foi usado' };
        if (t.expira_em <= agora) return { erro: 'Token de instalação expirado' };
        const id = randomUUID();
        const segredo = gerarToken();
        const i = req.body.info;
        const site = db.prepare('SELECT id FROM sites WHERE id = ?').get(t.site_id) ? t.site_id : 1;
        db.prepare(`INSERT INTO agentes (id, segredo_hash, hostname, so, so_versao, arquitetura, versao_agente, registrado_em, status, site_id, capacidades_json)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pendente', ?, ?)`)
          .run(id, sha256(segredo), i.hostname, i.so ?? null, i.so_versao ?? null, i.arquitetura ?? null, i.versao_agente ?? null, agora, site,
            i.capacidades ? JSON.stringify(i.capacidades) : null);
        db.prepare('UPDATE tokens_instalacao SET usado_em = ?, agente_id = ? WHERE id = ?').run(agora, id, t.id);
        return { id, segredo, criadoPor: t.criado_por, hostname: i.hostname };
      });
      if (resultado.erro) {
        ctx.auditar({ acao: 'agente_registro_negado', detalhes: resultado.erro, ip: req.ip });
        return reply.code(401).send({ erro: resultado.erro });
      }
      ctx.auditar({ usuario: resultado.criadoPor, acao: 'agente_registrado', alvo: `${resultado.hostname} (${resultado.id})`, agente_id: resultado.id, ip: req.ip });
      ctx.emitir('agente', { id: resultado.id, hostname: resultado.hostname, status: 'pendente', novo: true });
      return { id: resultado.id, segredo: resultado.segredo, intervalo: config.intervaloCheckin };
    });

    app.post('/api/agente/checkin', {
      preHandler: ctx.autenticarAgente,
      bodyLimit: 8 * 1024 * 1024, // inventário com milhares de softwares
      config: ctx.limiteAgente(),
      schema: { body: { type: 'object', required: ['metricas'], additionalProperties: false,
        properties: {
          metricas: metricasSchema, inventario: inventarioSchema, info: infoSchema,
          // Dados extras coletados por módulos do agente: { <modulo>: {...} } — consumidos pelos ganchos aoCheckin.
          extras: { type: 'object', maxProperties: 50, additionalProperties: { type: ['object', 'array', 'null'] } },
        } } },
    }, async (req) => {
      const a = req.agente;
      const m = req.body.metricas;
      const agora = Date.now();
      const discos = m.discos ?? [];
      const pior = discos.reduce((acc, d) => (d.pct != null && d.pct > (acc?.pct ?? -1) ? d : acc), null);
      const ramPct = m.ram_total ? (m.ram_usada / m.ram_total) * 100 : null;
      const info = req.body.info;

      db.prepare(`UPDATE agentes SET cpu_pct = ?, ram_usada = ?, ram_total = ?, disco_max_pct = ?, discos_json = ?,
          uptime = ?, usuario_logado = ?, ip_local = ?, ultimo_checkin = ?, status = 'online',
          hostname = COALESCE(?, hostname), so = COALESCE(?, so), so_versao = COALESCE(?, so_versao),
          arquitetura = COALESCE(?, arquitetura), versao_agente = COALESCE(?, versao_agente),
          capacidades_json = COALESCE(?, capacidades_json)
        WHERE id = ?`)
        .run(m.cpu ?? null, m.ram_usada ?? null, m.ram_total ?? null, pior?.pct ?? null, JSON.stringify(discos),
          m.uptime ?? null, m.usuario ?? null, m.ip ?? null, agora,
          info?.hostname ?? null, info?.so ?? null, info?.so_versao ?? null, info?.arquitetura ?? null, info?.versao_agente ?? null,
          info?.capacidades ? JSON.stringify(info.capacidades) : null, a.id);

      if (req.body.inventario) {
        db.prepare('UPDATE agentes SET inventario_json = ?, inventario_em = ? WHERE id = ?')
          .run(JSON.stringify(req.body.inventario), agora, a.id);
      }

      const ultima = db.prepare('SELECT MAX(ts) AS ts FROM metricas WHERE agente_id = ?').get(a.id).ts ?? 0;
      if (agora - ultima >= INTERVALO_AMOSTRA) {
        db.prepare('INSERT INTO metricas (agente_id, ts, cpu, ram_pct, disco_pct) VALUES (?, ?, ?, ?, ?)')
          .run(a.id, agora, m.cpu ?? null, ramPct, pior?.pct ?? null);
      }
      if (a.status !== 'online') ctx.emitir('agente', { id: a.id, hostname: a.hostname, status: 'online' });

      const resumo = { agora, ramPct, cpu: m.cpu ?? null, discoMax: pior?.pct ?? null, discoPonto: pior?.ponto ?? null };
      for (const g of ctx.ganchos.aoCheckin) {
        try { await g.fn(a, req.body, ctx, resumo); } catch (e) { req.log.error({ err: e, modulo: g.modulo }, 'falha em aoCheckin'); }
      }

      const invEm = req.body.inventario ? agora : a.inventario_em;
      const resposta = {
        intervalo: config.intervaloCheckin,
        pedirInventario: !invEm || agora - invEm > INVENTARIO_VALIDADE + 300_000,
        comandos: ctx.comandos.pendentesParaCheckin(a.id),
        tempoReal: '/api/agente/ws',
      };
      const atualizado = db.prepare('SELECT * FROM agentes WHERE id = ?').get(a.id);
      for (const g of ctx.ganchos.tarefasAgente) {
        try {
          const extra = await g.fn(atualizado, ctx);
          for (const [k, v] of Object.entries(extra ?? {})) {
            if (RESERVADAS.has(k) || k in resposta) { req.log.warn(`módulo ${g.modulo} tentou sobrescrever "${k}" na resposta do check-in`); continue; }
            resposta[k] = v;
          }
        } catch (e) { req.log.error({ err: e, modulo: g.modulo }, 'falha em tarefasAgente'); }
      }

      ctx.emitir('checkin', {
        id: a.id, hostname: info?.hostname ?? a.hostname, status: 'online', cpu_pct: m.cpu ?? null,
        ram_usada: m.ram_usada ?? null, ram_total: m.ram_total ?? null, disco_max_pct: pior?.pct ?? null,
        uptime: m.uptime ?? null, ip_local: m.ip ?? null, usuario_logado: m.usuario ?? null, ultimo_checkin: agora,
      });
      return resposta;
    });

    app.post('/api/agente/comando-resultado', {
      preHandler: ctx.autenticarAgente,
      bodyLimit: 4 * 1024 * 1024,
      config: ctx.limiteAgente(),
      schema: { body: { type: 'object', required: ['id', 'ok'], additionalProperties: false, properties: {
        id: { type: 'integer', minimum: 1 }, ok: { type: 'boolean' }, dados: {}, erro: { type: ['string', 'null'], maxLength: 2000 },
      } } },
    }, async (req, reply) => {
      if (!ctx.comandos.concluir(req.agente.id, req.body)) return reply.code(404).send({ erro: 'Comando não encontrado ou já concluído' });
      return { ok: true };
    });

    app.get('/download/farol-agente.pyz', async (_req, reply) => {
      const p = pacoteAgente(config.pastaAgente);
      if (!p) return reply.code(404).send({ erro: 'Pacote do agente indisponível neste servidor' });
      return reply.type('application/zip')
        .header('content-disposition', 'attachment; filename="farol-agente.pyz"')
        .header('x-farol-sha256', p.sha256).send(p.dados);
    });

    // =============================== API do painel ===============================
    app.get('/api/agentes', {
      preHandler: ver,
      schema: { querystring: { type: 'object', properties: { ...ESCOPO_QUERY } } },
    }, async (req) => {
      const f = filtroEscopo(req.query);
      const linhas = db.prepare(`SELECT ${COLUNAS} ${FROM} WHERE a.revogado = 0${f.sql} ORDER BY a.hostname COLLATE NOCASE`).all(...f.args);
      const online = new Set(ctx.canalAgentes.conectados());
      for (const l of linhas) l.tempo_real = online.has(l.id);
      return ctx.servicos.agentes.enriquecer(linhas);
    });

    app.get('/api/agentes/:id', { preHandler: ver, schema: { params: PARAMS_AGENTE } }, async (req, reply) => {
      const a = db.prepare(`SELECT ${COLUNAS}, a.discos_json, a.inventario_json, a.inventario_em, a.revogado, a.capacidades_json
        ${FROM} WHERE a.id = ?`).get(req.params.id);
      if (!a) return reply.code(404).send({ erro: 'Dispositivo não encontrado' });
      const { discos_json, inventario_json, capacidades_json, ...resto } = a;
      const [linha] = ctx.servicos.agentes.enriquecer([{ ...resto, tempo_real: ctx.canalAgentes.conectado(a.id) }]);
      return {
        ...linha,
        discos: JSON.parse(discos_json || '[]'),
        inventario: inventario_json ? JSON.parse(inventario_json) : null,
        capacidades: capacidades_json ? JSON.parse(capacidades_json) : [],
      };
    });

    app.get('/api/agentes/:id/metricas', {
      preHandler: ver,
      schema: { params: PARAMS_AGENTE, querystring: { type: 'object', properties: { horas: { type: 'integer', minimum: 1, maximum: 168, default: 24 } } } },
    }, async (req) => {
      const horas = req.query.horas;
      const balde = horas <= 1 ? 60_000 : horas <= 24 ? 300_000 : 1_800_000;
      const desde = Date.now() - horas * 3600_000;
      const pontos = db.prepare(`SELECT (ts / ?) * ? AS t, AVG(cpu) AS cpu, AVG(ram_pct) AS ram, AVG(disco_pct) AS disco
        FROM metricas WHERE agente_id = ? AND ts >= ? GROUP BY ts / ? ORDER BY t`)
        .all(balde, balde, req.params.id, desde, balde);
      return { horas, baldeMs: balde, desde, pontos };
    });

    app.put('/api/agentes/:id', {
      preHandler: ctx.exigir('dispositivos.editar'),
      schema: { params: PARAMS_AGENTE, body: { type: 'object', additionalProperties: false, minProperties: 1, properties: {
        descricao: { type: ['string', 'null'], maxLength: 500 }, site_id: { type: 'integer', minimum: 1 },
      } } },
    }, async (req, reply) => {
      const a = db.prepare('SELECT id, hostname, site_id FROM agentes WHERE id = ? AND revogado = 0').get(req.params.id);
      if (!a) return reply.code(404).send({ erro: 'Dispositivo não encontrado' });
      const b = req.body;
      if (b.site_id != null && !ctx.servicos.organizacao.siteExiste(b.site_id)) return reply.code(400).send({ erro: 'Site inexistente' });
      if (b.site_id != null) db.prepare('UPDATE agentes SET site_id = ? WHERE id = ?').run(b.site_id, a.id);
      if (b.descricao !== undefined) db.prepare('UPDATE agentes SET descricao = ? WHERE id = ?').run(b.descricao || null, a.id);
      ctx.auditarReq(req, b.site_id != null && b.site_id !== a.site_id ? 'dispositivo_movido' : 'dispositivo_alterado',
        { alvo: a.hostname, agente_id: a.id, detalhes: b });
      ctx.emitir('agente', { id: a.id, hostname: a.hostname });
      return { ok: true };
    });

    app.post('/api/agentes/mover', {
      preHandler: ctx.exigir('dispositivos.editar'),
      schema: { body: { type: 'object', required: ['agentes', 'site_id'], additionalProperties: false, properties: {
        agentes: { type: 'array', minItems: 1, maxItems: 5000, uniqueItems: true, items: { type: 'string', pattern: '^[0-9a-f-]{36}$' } },
        site_id: { type: 'integer', minimum: 1 },
      } } },
    }, async (req, reply) => {
      if (!ctx.servicos.organizacao.siteExiste(req.body.site_id)) return reply.code(400).send({ erro: 'Site inexistente' });
      const upd = db.prepare('UPDATE agentes SET site_id = ? WHERE id = ? AND revogado = 0');
      const n = transacao(db, () => req.body.agentes.reduce((t, id) => t + Number(upd.run(req.body.site_id, id).changes), 0));
      ctx.auditarReq(req, 'dispositivos_movidos', { alvo: `${n} dispositivo(s)`, detalhes: req.body });
      ctx.emitir('agente', { movidos: n });
      return { movidos: n };
    });

    app.post('/api/agentes/:id/revogar', { preHandler: ctx.exigir('dispositivos.revogar'), schema: { params: PARAMS_AGENTE } }, async (req, reply) => {
      const a = db.prepare('SELECT id, hostname, revogado FROM agentes WHERE id = ?').get(req.params.id);
      if (!a) return reply.code(404).send({ erro: 'Dispositivo não encontrado' });
      if (a.revogado) return reply.code(409).send({ erro: 'Dispositivo já revogado' });
      db.prepare("UPDATE agentes SET revogado = 1, status = 'revogado' WHERE id = ?").run(a.id);
      ctx.comandos.cancelarDoAgente(a.id);
      ctx.canalAgentes.desconectar(a.id);
      ctx.auditarReq(req, 'agente_revogado', { alvo: `${a.hostname} (${a.id})`, agente_id: a.id });
      ctx.emitir('agente', { id: a.id, hostname: a.hostname, status: 'revogado' });
      return { ok: true };
    });

    // Reiniciar / desligar: comando tipado "energia.<acao>" (o agente agenda com alguns segundos de atraso).
    app.post('/api/agentes/:id/energia', {
      preHandler: ctx.exigir('dispositivos.energia', { elevado: true }),
      schema: { params: PARAMS_AGENTE, body: { type: 'object', required: ['acao'], additionalProperties: false,
        properties: { acao: { type: 'string', enum: ['reiniciar', 'desligar'] } } } },
    }, async (req, reply) => {
      const a = db.prepare('SELECT id, hostname FROM agentes WHERE id = ? AND revogado = 0').get(req.params.id);
      if (!a) return reply.code(404).send({ erro: 'Dispositivo não encontrado' });
      const { id, entregue, resultado } = ctx.comandos.enviar(a.id, `energia.${req.body.acao}`, { atraso_s: 10 },
        { usuario: req.sessao.usuario, timeoutMs: 15_000, validadeMs: 15 * 60_000 });
      ctx.auditarReq(req, `dispositivo_${req.body.acao}`, { alvo: a.hostname, agente_id: a.id, detalhes: { comando: id } });
      if (!entregue) return { comando_id: id, status: 'pendente' };
      try {
        return { comando_id: id, status: 'sucesso', resultado: await resultado };
      } catch (e) {
        return reply.code(e.statusCode ?? 502).send({ erro: e.message, comando_id: id });
      }
    });

    app.get('/api/resumo', {
      preHandler: ver,
      schema: { querystring: { type: 'object', properties: { ...ESCOPO_QUERY } } },
    }, async (req) => {
      const f = filtroEscopo(req.query);
      const base = `FROM agentes a WHERE a.revogado = 0${f.sql}`;
      const c = db.prepare(`SELECT COUNT(*) AS total, SUM(status = 'online') AS online, SUM(status = 'offline') AS offline,
        SUM(status = 'pendente') AS pendente ${base}`).get(...f.args);
      const sistemas = db.prepare(`SELECT COALESCE(NULLIF(a.so, ''), 'Desconhecido') AS so, COUNT(*) AS n ${base} GROUP BY 1 ORDER BY n DESC`).all(...f.args);
      const disco = db.prepare(`SELECT SUM(disco_max_pct < 75) AS ok, SUM(disco_max_pct >= 75 AND disco_max_pct < 90) AS alerta,
        SUM(disco_max_pct >= 90) AS critico, SUM(disco_max_pct IS NULL) AS sem_dado ${base}`).get(...f.args);
      const piores = db.prepare(`SELECT ${COLUNAS},
          MAX(COALESCE(a.cpu_pct, 0), COALESCE(a.ram_usada * 100.0 / NULLIF(a.ram_total, 0), 0), COALESCE(a.disco_max_pct, 0)) AS pior
        ${FROM} WHERE a.revogado = 0 AND a.status = 'online'${f.sql} ORDER BY pior DESC LIMIT 6`).all(...f.args);
      return {
        total: c.total || 0, online: c.online || 0, offline: c.offline || 0, pendente: c.pendente || 0,
        tempoReal: ctx.canalAgentes.conectados().length,
        sistemas, disco: { ok: disco.ok || 0, alerta: disco.alerta || 0, critico: disco.critico || 0, sem_dado: disco.sem_dado || 0 },
        piores,
      };
    });

    // ---------- Tokens de instalação ----------
    const instalar = ctx.exigir('dispositivos.instalar');
    app.get('/api/tokens-instalacao', { preHandler: instalar }, async () =>
      db.prepare(`SELECT t.id, t.descricao, t.criado_por, t.criado_em, t.expira_em, t.usado_em, t.agente_id, t.site_id,
          a.hostname, s.nome AS site_nome
        FROM tokens_instalacao t LEFT JOIN agentes a ON a.id = t.agente_id LEFT JOIN sites s ON s.id = t.site_id
        ORDER BY t.id DESC LIMIT 50`).all());

    app.post('/api/tokens-instalacao', {
      preHandler: instalar,
      schema: { body: { type: 'object', additionalProperties: false, properties: {
        descricao: { type: 'string', maxLength: 120 }, site_id: { type: 'integer', minimum: 1 },
      } } },
    }, async (req, reply) => {
      const siteId = req.body?.site_id ?? 1;
      if (!ctx.servicos.organizacao.siteExiste(siteId)) return reply.code(400).send({ erro: 'Site inexistente' });
      const token = gerarToken();
      const agora = Date.now();
      const expira = agora + 24 * 3600_000;
      const r = db.prepare(`INSERT INTO tokens_instalacao (token_hash, descricao, criado_por, criado_em, expira_em, site_id)
        VALUES (?, ?, ?, ?, ?, ?)`).run(sha256(token), req.body?.descricao || null, req.sessao.usuario, agora, expira, siteId);
      ctx.auditarReq(req, 'token_criado', { alvo: `token #${r.lastInsertRowid}`, detalhes: req.body?.descricao || null });
      const url = urlServidor(req);
      return { id: Number(r.lastInsertRowid), token, expira_em: expira, servidor: url, site_id: siteId, comandos: comandosInstalacao(url, token) };
    });

    app.delete('/api/tokens-instalacao/:id', { preHandler: instalar, schema: { params: PARAMS_ID } }, async (req, reply) => {
      const r = db.prepare('DELETE FROM tokens_instalacao WHERE id = ? AND usado_em IS NULL').run(req.params.id);
      if (!r.changes) return reply.code(404).send({ erro: 'Token não encontrado ou já usado' });
      ctx.auditarReq(req, 'token_revogado', { alvo: `token #${req.params.id}` });
      return { ok: true };
    });
  },

  aoIniciar(ctx) {
    // Marca como offline quem parou de fazer check-in.
    ctx.agendador.registrar('agentes.offline', 10_000, ({ db, config }, agora) => {
      const caidos = db.prepare(`SELECT id, hostname FROM agentes
        WHERE revogado = 0 AND status = 'online' AND ultimo_checkin < ?`).all(agora - config.offlineSegundos * 1000);
      for (const a of caidos) {
        db.prepare("UPDATE agentes SET status = 'offline' WHERE id = ?").run(a.id);
        ctx.emitir('agente', { id: a.id, hostname: a.hostname, status: 'offline' });
      }
    });
    ctx.agendador.registrar('agentes.limpeza', 3600_000, ({ db, config }, agora) => {
      db.prepare('DELETE FROM metricas WHERE ts < ?').run(agora - config.retencaoMetricasDias * 86400_000);
      db.prepare('DELETE FROM tokens_instalacao WHERE usado_em IS NULL AND expira_em < ?').run(agora - 7 * 86400_000);
      db.prepare("DELETE FROM comandos WHERE status NOT IN ('pendente', 'enviado') AND criado_em < ?").run(agora - 7 * 86400_000);
    }, { imediato: true });
  },
};
