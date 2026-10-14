// Políticas: um pacote nomeado de exceções de alerta (overrides) + moldes de agendamento, aplicado de uma
// vez a um alvo (agente/site/cliente/todos/grupo). Nunca reinventa alertas nem agendamentos — "aplicar"
// só chama ctx.servicos.alertas.definirOverride() e ctx.servicos.agendamentos.criar()/atualizar() pra cada
// dispositivo/molde, a mesma lógica (e as mesmas validações) por trás das rotas manuais de cada um.
// Reaplicar a mesma política no mesmo alvo ATUALIZA os agendamentos já criados (ver politicas_agendamentos),
// em vez de duplicá-los a cada "aplicar".
import { PARAMS_ID, ALVO_SCHEMA, erroHttp } from '../../nucleo/util.js';
import { TIPOS_OVERRIDE } from '../alertas/index.js';

const OVERRIDE_TIPO_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    ativo: { type: 'boolean' },
    limite: { type: 'number', minimum: 1, maximum: 100 },
    ciclos: { type: 'integer', minimum: 1, maximum: 100 },
    minutos: { type: 'integer', minimum: 1, maximum: 10_080 },
  },
};
const OVERRIDES_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: Object.fromEntries(TIPOS_OVERRIDE.map((t) => [t, OVERRIDE_TIPO_SCHEMA])),
};
const AGENDAMENTO_TEMPLATE_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['nome', 'tipo'],
  properties: {
    nome: { type: 'string', minLength: 1, maxLength: 150 },
    script_id: { type: 'integer', minimum: 1 },
    biblioteca_id: { type: 'string', pattern: '^[a-z0-9][a-z0-9-]{0,79}$' },
    variaveis: { type: 'object', maxProperties: 30, additionalProperties: { type: ['string', 'number', 'boolean', 'null'] } },
    timeout: { type: 'integer', minimum: 5, maximum: 86_400 },
    tipo: { type: 'string', enum: ['intervalo', 'cron'] },
    intervalo_min: { type: 'integer', minimum: 1, maximum: 10_080 },
    cron: { type: 'string', maxLength: 100 },
  },
};

const assinaturaAlvo = (alvo) => `${alvo.tipo}:${Array.isArray(alvo.id) ? alvo.id.join(',') : alvo.id ?? ''}`;

function linhaPublica(p) {
  return {
    id: p.id, nome: p.nome, descricao: p.descricao,
    overrides: JSON.parse(p.overrides_json), agendamentos: JSON.parse(p.agendamentos_json),
    criado_por: p.criado_por, criado_em: p.criado_em, atualizado_em: p.atualizado_em,
  };
}

/** Valida que cada molde de agendamento aponta pra um script/biblioteca de verdade (erro cedo, na criação
 * da política — não só quando alguém for aplicá-la num alvo de produção). */
function validarAgendamentos(ctx, agendamentos) {
  for (const tpl of agendamentos) {
    if (!tpl.script_id && !tpl.biblioteca_id) return `"${tpl.nome}": informe script_id ou biblioteca_id`;
    if (tpl.script_id && tpl.biblioteca_id) return `"${tpl.nome}": informe só um, script_id ou biblioteca_id`;
    if (tpl.tipo === 'intervalo' && !tpl.intervalo_min) return `"${tpl.nome}": informe intervalo_min`;
    if (tpl.tipo === 'cron' && !tpl.cron) return `"${tpl.nome}": informe cron`;
    const { erro } = ctx.servicos.jobs.resolverScript({ script_id: tpl.script_id, biblioteca_id: tpl.biblioteca_id });
    if (erro) return `"${tpl.nome}": ${erro}`;
  }
  return null;
}

/**
 * Aplica a política num alvo: define as exceções de alerta pra cada dispositivo resolvido e cria/atualiza
 * um agendamento por molde (reaplicar no MESMO alvo atualiza os agendamentos já criados, não duplica).
 */
async function aplicarPolitica(ctx, pol, alvo, { usuario, ip = null }) {
  const resolvidos = await ctx.alvos.resolver(alvo);
  if (!resolvidos.length) throw erroHttp(400, 'Nenhum dispositivo no alvo escolhido');

  const overrides = JSON.parse(pol.overrides_json);
  let overridesAplicados = 0;
  for (const agente of resolvidos) {
    for (const [tipo, ajustes] of Object.entries(overrides)) {
      ctx.servicos.alertas.definirOverride(agente.id, tipo, ajustes, { usuario: `política "${pol.nome}"` });
      overridesAplicados++;
    }
  }

  const assinatura = assinaturaAlvo(alvo);
  const templates = JSON.parse(pol.agendamentos_json);
  const resultadoAgendamentos = [];
  for (let i = 0; i < templates.length; i++) {
    const tpl = templates[i];
    const dados = { ...tpl, nome: `[${pol.nome}] ${tpl.nome}`, alvo };
    const existente = ctx.db.prepare('SELECT agendamento_id FROM politicas_agendamentos WHERE politica_id = ? AND alvo_assinatura = ? AND indice = ?')
      .get(pol.id, assinatura, i);
    let r = existente ? await ctx.servicos.agendamentos.atualizar(existente.agendamento_id, dados, { usuario, ip }) : null;
    if (!existente || (r.erro && r.status === 404)) {
      // nunca aplicado a este alvo, ou o agendamento foi apagado manualmente nesse meio tempo: cria de novo.
      r = await ctx.servicos.agendamentos.criar(dados, { usuario, ip });
      if (!r.erro) {
        ctx.db.prepare(`INSERT INTO politicas_agendamentos (politica_id, alvo_assinatura, indice, agendamento_id) VALUES (?, ?, ?, ?)
          ON CONFLICT(politica_id, alvo_assinatura, indice) DO UPDATE SET agendamento_id = excluded.agendamento_id`)
          .run(pol.id, assinatura, i, r.linha.id);
      }
    }
    resultadoAgendamentos.push(r.erro
      ? { nome: tpl.nome, erro: r.erro }
      : { nome: tpl.nome, agendamento_id: r.linha.id, acao: existente ? 'atualizado' : 'criado' });
  }

  const resultado = { dispositivos: resolvidos.length, overridesAplicados, agendamentos: resultadoAgendamentos };
  ctx.db.prepare(`INSERT INTO politicas_aplicacoes (politica_id, alvo_json, alvo_assinatura, dispositivos, overrides_aplicados, agendamentos_resultado_json, aplicado_por, aplicado_em)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(pol.id, JSON.stringify(alvo), assinatura, resolvidos.length, overridesAplicados, JSON.stringify(resultadoAgendamentos), usuario, Date.now());
  ctx.auditar({ usuario, ip, acao: 'politica_aplicada', alvo: pol.nome, detalhes: { politica_id: pol.id, alvo_destino: alvo, ...resultado } });
  ctx.emitir('politica', { id: pol.id, aplicada: true, alvo });
  return resultado;
}

export default {
  nome: 'politicas',
  descricao: 'Políticas: exceções de alerta + agendamentos aplicados de uma vez a um site/grupo',
  depende: ['agentes', 'jobs', 'alertas', 'agendamentos'],
  permissoes: {
    'politicas.ver': { descricao: 'Ver políticas e o histórico de aplicações', papeis: ['tecnico', 'leitura'] },
    'politicas.gerenciar': { descricao: 'Criar, editar, excluir e aplicar políticas (exige 2FA para aplicar)', papeis: ['tecnico'] },
  },

  migracoes: [
    `CREATE TABLE politicas (
      id INTEGER PRIMARY KEY,
      nome TEXT NOT NULL,
      descricao TEXT,
      overrides_json TEXT NOT NULL DEFAULT '{}',
      agendamentos_json TEXT NOT NULL DEFAULT '[]',
      criado_por TEXT NOT NULL,
      criado_em INTEGER NOT NULL,
      atualizado_em INTEGER NOT NULL
    );
    CREATE TABLE politicas_aplicacoes (
      id INTEGER PRIMARY KEY,
      politica_id INTEGER NOT NULL REFERENCES politicas(id) ON DELETE CASCADE,
      alvo_json TEXT NOT NULL,
      alvo_assinatura TEXT NOT NULL,
      dispositivos INTEGER NOT NULL,
      overrides_aplicados INTEGER NOT NULL,
      agendamentos_resultado_json TEXT NOT NULL,
      aplicado_por TEXT NOT NULL,
      aplicado_em INTEGER NOT NULL
    );
    CREATE INDEX ix_politicas_aplicacoes ON politicas_aplicacoes(politica_id, id DESC);
    CREATE TABLE politicas_agendamentos (
      politica_id INTEGER NOT NULL REFERENCES politicas(id) ON DELETE CASCADE,
      alvo_assinatura TEXT NOT NULL,
      indice INTEGER NOT NULL,
      agendamento_id INTEGER NOT NULL REFERENCES agendamentos(id) ON DELETE CASCADE,
      PRIMARY KEY (politica_id, alvo_assinatura, indice)
    );`,
  ],

  rotas(app, ctx) {
    const { db } = ctx;
    const ver = ctx.exigir('politicas.ver');
    const gerenciar = ctx.exigir('politicas.gerenciar', { elevado: true });

    const corpoBase = {
      nome: { type: 'string', minLength: 1, maxLength: 120 },
      descricao: { type: 'string', maxLength: 500 },
      overrides: OVERRIDES_SCHEMA,
      agendamentos: { type: 'array', maxItems: 20, items: AGENDAMENTO_TEMPLATE_SCHEMA },
    };

    app.get('/api/politicas', { preHandler: ver }, async () =>
      db.prepare('SELECT * FROM politicas ORDER BY nome COLLATE NOCASE').all().map(linhaPublica));

    app.get('/api/politicas/:id', { preHandler: ver, schema: { params: PARAMS_ID } }, async (req, reply) => {
      const p = db.prepare('SELECT * FROM politicas WHERE id = ?').get(req.params.id);
      if (!p) return reply.code(404).send({ erro: 'Política não encontrada' });
      const aplicacoes = db.prepare(`SELECT id, alvo_json, dispositivos, overrides_aplicados, agendamentos_resultado_json, aplicado_por, aplicado_em
        FROM politicas_aplicacoes WHERE politica_id = ? ORDER BY id DESC LIMIT 20`).all(p.id)
        .map((a) => ({ id: a.id, alvo: JSON.parse(a.alvo_json), dispositivos: a.dispositivos, overrides_aplicados: a.overrides_aplicados,
          agendamentos: JSON.parse(a.agendamentos_resultado_json), aplicado_por: a.aplicado_por, aplicado_em: a.aplicado_em }));
      return { ...linhaPublica(p), aplicacoes };
    });

    app.post('/api/politicas', {
      preHandler: gerenciar,
      schema: { body: { type: 'object', additionalProperties: false, required: ['nome'], properties: corpoBase } },
    }, async (req, reply) => {
      const b = req.body;
      const overrides = b.overrides ?? {};
      const agendamentos = b.agendamentos ?? [];
      if (!Object.keys(overrides).length && !agendamentos.length) return reply.code(400).send({ erro: 'A política precisa de ao menos uma exceção de alerta ou um molde de agendamento' });
      const erroAg = validarAgendamentos(ctx, agendamentos);
      if (erroAg) return reply.code(400).send({ erro: erroAg });
      const agora = Date.now();
      const r = db.prepare('INSERT INTO politicas (nome, descricao, overrides_json, agendamentos_json, criado_por, criado_em, atualizado_em) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(b.nome, b.descricao ?? null, JSON.stringify(overrides), JSON.stringify(agendamentos), req.sessao.usuario, agora, agora);
      const id = Number(r.lastInsertRowid);
      ctx.auditarReq(req, 'politica_criada', { alvo: b.nome, detalhes: { id, overrides, agendamentos: agendamentos.map((a) => a.nome) } });
      ctx.emitir('politica', { id, criada: true });
      return reply.code(201).send(linhaPublica(db.prepare('SELECT * FROM politicas WHERE id = ?').get(id)));
    });

    app.put('/api/politicas/:id', {
      preHandler: gerenciar,
      schema: { params: PARAMS_ID, body: { type: 'object', additionalProperties: false, minProperties: 1, properties: corpoBase } },
    }, async (req, reply) => {
      const atual = db.prepare('SELECT * FROM politicas WHERE id = ?').get(req.params.id);
      if (!atual) return reply.code(404).send({ erro: 'Política não encontrada' });
      const b = req.body;
      const overrides = b.overrides ?? JSON.parse(atual.overrides_json);
      const agendamentos = b.agendamentos ?? JSON.parse(atual.agendamentos_json);
      const erroAg = validarAgendamentos(ctx, agendamentos);
      if (erroAg) return reply.code(400).send({ erro: erroAg });
      db.prepare('UPDATE politicas SET nome = ?, descricao = ?, overrides_json = ?, agendamentos_json = ?, atualizado_em = ? WHERE id = ?')
        .run(b.nome ?? atual.nome, b.descricao !== undefined ? b.descricao : atual.descricao, JSON.stringify(overrides), JSON.stringify(agendamentos), Date.now(), atual.id);
      ctx.auditarReq(req, 'politica_alterada', { alvo: b.nome ?? atual.nome, detalhes: { id: atual.id } });
      ctx.emitir('politica', { id: atual.id, alterada: true });
      return linhaPublica(db.prepare('SELECT * FROM politicas WHERE id = ?').get(atual.id));
    });

    app.delete('/api/politicas/:id', { preHandler: gerenciar, schema: { params: PARAMS_ID } }, async (req, reply) => {
      const p = db.prepare('SELECT id, nome FROM politicas WHERE id = ?').get(req.params.id);
      if (!p) return reply.code(404).send({ erro: 'Política não encontrada' });
      db.prepare('DELETE FROM politicas WHERE id = ?').run(p.id);
      ctx.auditarReq(req, 'politica_excluida', { alvo: p.nome, detalhes: { id: p.id } });
      ctx.emitir('politica', { id: p.id, excluida: true });
      return { ok: true };
    });

    app.post('/api/politicas/:id/aplicar', {
      preHandler: gerenciar,
      schema: { params: PARAMS_ID, body: { type: 'object', additionalProperties: false, required: ['alvo'], properties: { alvo: ALVO_SCHEMA } } },
    }, async (req, reply) => {
      const p = db.prepare('SELECT * FROM politicas WHERE id = ?').get(req.params.id);
      if (!p) return reply.code(404).send({ erro: 'Política não encontrada' });
      try {
        const resultado = await aplicarPolitica(ctx, p, req.body.alvo, { usuario: req.sessao.usuario, ip: req.ip });
        return resultado;
      } catch (e) {
        if (e.statusCode) return reply.code(e.statusCode).send({ erro: e.message, ...(e.extra ?? {}) });
        throw e;
      }
    });
  },
};
