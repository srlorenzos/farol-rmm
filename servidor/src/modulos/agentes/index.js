// Dispositivos (agentes): registro, check-in, métricas, inventário, tokens de instalação, ações de energia
// e o download do pacote do agente. As tabelas são do núcleo; este módulo é a API.
//
// Pipeline do check-in (POST /api/agente/checkin):
//   1. atualiza métricas/inventário/capacidades   2. amostra histórico (1/min)
//   3. ganchos aoCheckin de todos os módulos       4. resposta = { intervalo, pedirInventario, comandos, tempoReal }
//      + o que os ganchos tarefasAgente devolverem (ex.: { jobs: [...] } do módulo jobs).
import { randomUUID } from 'node:crypto';
import { gerarToken, sha256 } from '../../seguranca.js';
import { transacao, lerConfig, definirConfig } from '../../db.js';
import { PARAMS_ID, PARAMS_AGENTE, filtroEscopo, ESCOPO_QUERY } from '../../nucleo/util.js';
import { pacoteAgente } from './pacote.js';

const INTERVALO_AMOSTRA = 60_000; // no máx. 1 ponto de histórico por minuto por agente
const INVENTARIO_VALIDADE = 3600_000;
const RESERVADAS = new Set(['intervalo', 'pedirInventario', 'comandos', 'tempoReal']);

// ======================================================================================
// Downsampling do histórico de métricas: granularidade fina (1 ponto/min) só por pouco
// tempo (retencaoMetricas.finaHoras); em paralelo, três tarefas periódicas agregam o bruto
// em camadas cada vez mais grossas — 15 min, 1 h, 1 dia — cada uma com min/max/média/p95,
// guardadas por mais tempo (14 d / 90 d / 365 d). A rota de histórico escolhe sozinha qual
// tabela servir conforme o período pedido, pra nunca mandar milhares de pontos crus ao
// navegador. Ver `agregarTier` e a rota GET /api/agentes/:id/metricas mais abaixo.
const CAMADAS = [
  { tabela: 'metricas_15m', ms: 900_000, marca: 'metricas_marca_15m' },
  { tabela: 'metricas_1h', ms: 3_600_000, marca: 'metricas_marca_1h' },
  { tabela: 'metricas_1d', ms: 86_400_000, marca: 'metricas_marca_1d' },
];
const MAX_BALDES_POR_EXECUCAO = 400; // proteção: nunca processa mais que isso de uma vez (catch-up gradual)

/** Percentil 95 por "nearest rank" — simples e suficiente pra um painel de monitoramento. */
function p95(valores) {
  if (!valores.length) return null;
  const v = [...valores].sort((a, b) => a - b);
  return v[Math.min(v.length - 1, Math.max(0, Math.ceil(0.95 * v.length) - 1))];
}

/** Agrega as linhas cruas de um balde (já agrupadas por agente) e grava/atualiza a linha da camada. */
function gravarBalde(db, tabela, agenteId, inicioBalde, linhas) {
  const dados = (campo) => linhas.map((l) => l[campo]).filter((x) => x != null);
  const media = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);
  const minMax = (arr) => (arr.length ? [Math.min(...arr), Math.max(...arr)] : [null, null]);
  const [cpuMin, cpuMax] = minMax(dados('cpu'));
  const [ramMin, ramMax] = minMax(dados('ram_pct'));
  const [discoMin, discoMax] = minMax(dados('disco_pct'));
  db.prepare(`INSERT INTO ${tabela}
      (agente_id, ts, n, cpu_min, cpu_max, cpu_avg, cpu_p95, ram_min, ram_max, ram_avg, ram_p95, disco_min, disco_max, disco_avg, disco_p95)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (agente_id, ts) DO UPDATE SET n = excluded.n,
      cpu_min = excluded.cpu_min, cpu_max = excluded.cpu_max, cpu_avg = excluded.cpu_avg, cpu_p95 = excluded.cpu_p95,
      ram_min = excluded.ram_min, ram_max = excluded.ram_max, ram_avg = excluded.ram_avg, ram_p95 = excluded.ram_p95,
      disco_min = excluded.disco_min, disco_max = excluded.disco_max, disco_avg = excluded.disco_avg, disco_p95 = excluded.disco_p95`)
    .run(agenteId, inicioBalde, linhas.length,
      cpuMin, cpuMax, media(dados('cpu')), p95(dados('cpu')),
      ramMin, ramMax, media(dados('ram_pct')), p95(dados('ram_pct')),
      discoMin, discoMax, media(dados('disco_pct')), p95(dados('disco_pct')));
}

/**
 * Agrega, direto da tabela `metricas` (dado cru), todos os baldes já fechados de uma camada que ainda
 * não foram processados (watermark em `config`). Sempre a partir do dado cru: como a agregação roda a
 * cada poucos minutos e o cru fica guardado por `finaHoras` (48 h por padrão), mesmo a camada diária tem
 * dado cru disponível quando processa o dia anterior — então min/max/p95 são exatos, nunca aproximados
 * a partir de uma camada mais grossa. Se o watermark ficou pra trás de tudo que ainda existe de cru
 * (servidor ficou off por muito tempo, ou o cru já foi podado), pula direto pro dado mais antigo
 * disponível — nunca trava tentando agregar um intervalo que não tem mais dado nenhum.
 */
function agregarTier(ctx, { tabela, ms, marca: chaveMarca }, agora) {
  const { db } = ctx;
  const minCru = db.prepare('SELECT MIN(ts) AS t FROM metricas').get().t;
  if (minCru == null) return 0; // nada pra agregar ainda
  let marca = Number(lerConfig(db, chaveMarca, 0)) || Math.floor(minCru / ms) * ms;
  const minAlinhado = Math.floor(minCru / ms) * ms;
  if (marca < minAlinhado) marca = minAlinhado;
  const fechado = Math.floor(agora / ms) * ms; // o balde corrente ainda está aberto: não agrega
  let processados = 0;
  while (marca < fechado && processados < MAX_BALDES_POR_EXECUCAO) {
    const linhas = db.prepare('SELECT agente_id, cpu, ram_pct, disco_pct FROM metricas WHERE ts >= ? AND ts < ? ORDER BY agente_id').all(marca, marca + ms);
    if (linhas.length) {
      const porAgente = new Map();
      for (const l of linhas) { if (!porAgente.has(l.agente_id)) porAgente.set(l.agente_id, []); porAgente.get(l.agente_id).push(l); }
      const inicioBalde = marca;
      transacao(db, () => { for (const [agenteId, ls] of porAgente) gravarBalde(db, tabela, agenteId, inicioBalde, ls); });
    }
    marca += ms;
    processados++;
  }
  if (processados) definirConfig(db, chaveMarca, marca);
  return processados;
}

/** Granularidade certa pra servir o período pedido: nunca manda milhares de pontos crus ao navegador. */
function granularidadeParaHoras(horas) {
  if (horas <= 2) return { bruto: true, baldeMs: 60_000 }; // 1 ponto/min — até 120 pontos
  if (horas <= 48) return { bruto: true, baldeMs: 300_000 }; // 5 min — dentro da retenção fina, até ~576 pontos
  if (horas <= 336) return { bruto: false, tabela: 'metricas_15m', baldeMs: 900_000 }; // até 14 dias: até ~1344 pontos
  if (horas <= 2160) return { bruto: false, tabela: 'metricas_1h', baldeMs: 3_600_000 }; // até 90 dias: até 2160 pontos
  return { bruto: false, tabela: 'metricas_1d', baldeMs: 86_400_000 }; // até 365 dias: até 365 pontos
}

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
  a.site_id, s.nome AS site_nome, s.cliente_id, c.nome AS cliente_nome, a.capacidades_json`;

/** Troca `capacidades_json` (coluna crua) por `capacidades` (array) numa linha — usado nas duas rotas de listagem. */
function comCapacidades(linha) {
  const { capacidades_json, ...resto } = linha;
  return { ...resto, capacidades: capacidades_json ? JSON.parse(capacidades_json) : [] };
}
const FROM = 'FROM agentes a JOIN sites s ON s.id = a.site_id JOIN clientes c ON c.id = s.cliente_id';

function ehLocal(url) {
  try {
    const h = new URL(url).hostname;
    return ['localhost', '127.0.0.1', '[::1]', '::1'].includes(h);
  } catch { return false; }
}

// Onde o instalador do Windows (Inno Setup) é baixado: padrão = último release do GitHub; FAROL_SETUP_URL troca.
const URL_SETUP = () => process.env.FAROL_SETUP_URL || 'https://github.com/srlorenzos/farol-rmm/releases/latest/download/FarolAgenteSetup.exe';

export function comandosInstalacao(url, token) {
  const inseguro = url.startsWith('http://') && !ehLocal(url) ? ' --inseguro' : '';
  return {
    // Instalador .exe, silencioso (serve para GPO/Intune/RMM): FarolAgenteSetup.exe /VERYSILENT /SERVIDOR= /TOKEN=
    windows_setup: `Invoke-WebRequest -UseBasicParsing "${URL_SETUP()}" -OutFile FarolAgenteSetup.exe; `
      + `Start-Process ./FarolAgenteSetup.exe -Wait -Verb RunAs -ArgumentList '/VERYSILENT','/SERVIDOR=${url}','/TOKEN=${token}'`,
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

  migracoes: [
    // 1 — downsampling do histórico de métricas: índice por ts (a agregação varre todos os agentes
    // num intervalo de tempo, não um agente só) + as três camadas agregadas (ver CAMADAS acima).
    `CREATE INDEX IF NOT EXISTS ix_metricas_ts ON metricas(ts);
    CREATE TABLE metricas_15m (
      agente_id TEXT NOT NULL REFERENCES agentes(id) ON DELETE CASCADE,
      ts INTEGER NOT NULL, n INTEGER NOT NULL,
      cpu_min REAL, cpu_max REAL, cpu_avg REAL, cpu_p95 REAL,
      ram_min REAL, ram_max REAL, ram_avg REAL, ram_p95 REAL,
      disco_min REAL, disco_max REAL, disco_avg REAL, disco_p95 REAL,
      PRIMARY KEY (agente_id, ts)
    );
    CREATE TABLE metricas_1h (
      agente_id TEXT NOT NULL REFERENCES agentes(id) ON DELETE CASCADE,
      ts INTEGER NOT NULL, n INTEGER NOT NULL,
      cpu_min REAL, cpu_max REAL, cpu_avg REAL, cpu_p95 REAL,
      ram_min REAL, ram_max REAL, ram_avg REAL, ram_p95 REAL,
      disco_min REAL, disco_max REAL, disco_avg REAL, disco_p95 REAL,
      PRIMARY KEY (agente_id, ts)
    );
    CREATE TABLE metricas_1d (
      agente_id TEXT NOT NULL REFERENCES agentes(id) ON DELETE CASCADE,
      ts INTEGER NOT NULL, n INTEGER NOT NULL,
      cpu_min REAL, cpu_max REAL, cpu_avg REAL, cpu_p95 REAL,
      ram_min REAL, ram_max REAL, ram_avg REAL, ram_p95 REAL,
      disco_min REAL, disco_max REAL, disco_avg REAL, disco_p95 REAL,
      PRIMARY KEY (agente_id, ts)
    );`,
  ],

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
      // Limite de dispositivos da licença (módulo licenca, opcional): recusa antes de gastar o token.
      const bloqueio = ctx.servicos.licenca?.verificarRegistro?.();
      if (bloqueio) {
        ctx.auditar({ acao: 'agente_registro_negado', detalhes: bloqueio, ip: req.ip });
        return reply.code(402).send({ erro: bloqueio });
      }
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
      const linhas = db.prepare(`SELECT ${COLUNAS} ${FROM} WHERE a.revogado = 0${f.sql} ORDER BY a.hostname COLLATE NOCASE`).all(...f.args).map(comCapacidades);
      const online = new Set(ctx.canalAgentes.conectados());
      for (const l of linhas) l.tempo_real = online.has(l.id);
      return ctx.servicos.agentes.enriquecer(linhas);
    });

    app.get('/api/agentes/:id', { preHandler: ver, schema: { params: PARAMS_AGENTE } }, async (req, reply) => {
      const a = db.prepare(`SELECT ${COLUNAS}, a.discos_json, a.inventario_json, a.inventario_em, a.revogado
        ${FROM} WHERE a.id = ?`).get(req.params.id);
      if (!a) return reply.code(404).send({ erro: 'Dispositivo não encontrado' });
      const { discos_json, inventario_json, ...resto } = comCapacidades(a);
      const [linha] = ctx.servicos.agentes.enriquecer([{ ...resto, tempo_real: ctx.canalAgentes.conectado(a.id) }]);
      return {
        ...linha,
        discos: JSON.parse(discos_json || '[]'),
        inventario: inventario_json ? JSON.parse(inventario_json) : null,
      };
    });

    app.get('/api/agentes/:id/metricas', {
      preHandler: ver,
      // 8760 h = 365 dias: cobre a maior camada agregada (diária, guardada por 1 ano por padrão).
      schema: { params: PARAMS_AGENTE, querystring: { type: 'object', properties: { horas: { type: 'integer', minimum: 1, maximum: 8760, default: 24 } } } },
    }, async (req) => {
      const horas = req.query.horas;
      const desde = Date.now() - horas * 3600_000;
      const g = granularidadeParaHoras(horas);
      const pontos = g.bruto
        ? db.prepare(`SELECT (ts / ?) * ? AS t, MIN(cpu) AS cpu_min, MAX(cpu) AS cpu_max, AVG(cpu) AS cpu,
              MIN(ram_pct) AS ram_min, MAX(ram_pct) AS ram_max, AVG(ram_pct) AS ram,
              MIN(disco_pct) AS disco_min, MAX(disco_pct) AS disco_max, AVG(disco_pct) AS disco
            FROM metricas WHERE agente_id = ? AND ts >= ? GROUP BY ts / ? ORDER BY t`)
          .all(g.baldeMs, g.baldeMs, req.params.id, desde, g.baldeMs)
        : db.prepare(`SELECT ts AS t, cpu_min, cpu_max, cpu_avg AS cpu, cpu_p95, ram_min, ram_max, ram_avg AS ram, ram_p95,
              disco_min, disco_max, disco_avg AS disco, disco_p95
            FROM ${g.tabela} WHERE agente_id = ? AND ts >= ? ORDER BY ts`)
          .all(req.params.id, desde);
      return { horas, baldeMs: g.baldeMs, desde, granularidade: g.bruto ? 'bruto' : g.tabela.replace('metricas_', ''), pontos };
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
    // Agrega o histórico bruto nas três camadas (15 min / 1 h / 1 dia) a cada 5 min — baldes já fechados
    // e ainda não processados (watermark por camada). Ver `agregarTier` acima.
    ctx.agendador.registrar('agentes.metricas_agregar', 300_000, (c, agora) => {
      for (const camada of CAMADAS) agregarTier(c, camada, agora);
    }, { imediato: true });

    ctx.agendador.registrar('agentes.limpeza', 3600_000, ({ db, config }, agora) => {
      const r = config.retencaoMetricas;
      // Nunca poda dado cru que uma camada ainda não processou (watermark) — mesmo que finaHoras já
      // tenha vencido. Em operação normal o watermark está sempre bem à frente desse piso.
      // Watermark desconhecido (camada nunca rodou ainda) vale 0 — protege TUDO até a primeira agregação,
      // em vez de confiar no corte por idade sozinho (que apagaria dado que nenhuma camada processou).
      const marcas = CAMADAS.map((c) => Number(lerConfig(db, c.marca, 0)));
      const piso = Math.min(agora - r.finaHoras * 3600_000, ...marcas);
      db.prepare('DELETE FROM metricas WHERE ts < ?').run(piso);
      db.prepare('DELETE FROM metricas_15m WHERE ts < ?').run(agora - r.quinzeMinDias * 86400_000);
      db.prepare('DELETE FROM metricas_1h WHERE ts < ?').run(agora - r.horaDias * 86400_000);
      db.prepare('DELETE FROM metricas_1d WHERE ts < ?').run(agora - r.diaDias * 86400_000);
      db.prepare('DELETE FROM tokens_instalacao WHERE usado_em IS NULL AND expira_em < ?').run(agora - 7 * 86400_000);
      db.prepare("DELETE FROM comandos WHERE status NOT IN ('pendente', 'enviado') AND criado_em < ?").run(agora - 7 * 86400_000);
    }, { imediato: true });
  },
};
