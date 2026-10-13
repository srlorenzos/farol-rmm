// Terminal interativo remoto: registra o tipo de sessão de relay 'terminal' (abertura, fechamento, permissão,
// 2FA e auditoria já são genéricos do núcleo — ver src/nucleo/relay.js). Este módulo só acrescenta:
//   - a permissão 'terminal.usar' (abrir sessão) e 'terminal.configurar' (gravação/tempo limite, só admin);
//   - configuração opcional de gravação de sessões (desligada por padrão — conteúdo digitado é sensível);
//   - leitura da transcrição gravada, para quando um admin ligar a gravação.
// O lado do agente fica em agente/farol/modulos/terminal.py (classe Terminal, sessão 'terminal').
import { lerConfig, definirConfig } from '../../db.js';
import { PARAMS_AGENTE } from '../../nucleo/util.js';

const CHAVE_GRAVAR = 'terminal.gravar_sessoes';
const CHAVE_TIMEOUT = 'terminal.timeout_ocioso_min';
const PADRAO_TIMEOUT_MIN = 20;
const MAX_LINHA = 4000; // uma gravação por chunk recebido; cada chunk já é limitado pelo relay (192 KB)

function configuracao(db) {
  return {
    gravar_sessoes: lerConfig(db, CHAVE_GRAVAR, false),
    timeout_ocioso_min: lerConfig(db, CHAVE_TIMEOUT, PADRAO_TIMEOUT_MIN),
  };
}

export default {
  nome: 'terminal',
  descricao: 'Terminal interativo remoto (sessão de relay sobre o canal em tempo real do agente)',
  depende: ['agentes'],
  permissoes: {
    'terminal.usar': { descricao: 'Abrir terminal interativo nos dispositivos', papeis: ['tecnico'] },
    'terminal.configurar': { descricao: 'Configurar gravação e tempo limite de inatividade do terminal' },
  },

  migracoes: [
    `CREATE TABLE terminal_gravacoes (
      id INTEGER PRIMARY KEY,
      sessao_id TEXT NOT NULL,
      agente_id TEXT NOT NULL,
      usuario TEXT NOT NULL,
      ts INTEGER NOT NULL,
      direcao TEXT NOT NULL,
      dados TEXT NOT NULL
    );
    CREATE INDEX ix_terminal_gravacoes_sessao ON terminal_gravacoes(sessao_id, id);`,
  ],

  aoIniciar(ctx) {
    ctx.relay.registrarTipo('terminal', {
      permissao: 'terminal.usar',
      elevado: true,
      descricao: 'Terminal interativo',
      aoDados: (direcao, s, dados) => {
        if (!lerConfig(ctx.db, CHAVE_GRAVAR, false)) return;
        ctx.db.prepare('INSERT INTO terminal_gravacoes (sessao_id, agente_id, usuario, ts, direcao, dados) VALUES (?, ?, ?, ?, ?, ?)')
          .run(s.id, s.agenteId, s.usuario, Date.now(), direcao, String(dados).slice(0, MAX_LINHA));
      },
    });
    // Gravações de sessões antigas não precisam viver para sempre.
    ctx.agendador.registrar('terminal.limpeza', 3600_000, ({ db }, agora) => {
      db.prepare('DELETE FROM terminal_gravacoes WHERE ts < ?').run(agora - 30 * 86400_000);
    });
  },

  rotas(app, ctx) {
    const { db } = ctx;
    const usar = ctx.exigir('terminal.usar');
    const configurar = ctx.exigir('terminal.configurar');

    // O painel consulta antes de abrir a sessão, para avisar claramente se ela será gravada.
    app.get('/api/terminal/config', { preHandler: usar }, async () => configuracao(db));

    app.put('/api/terminal/config', {
      preHandler: configurar,
      schema: { body: { type: 'object', additionalProperties: false, properties: {
        gravar_sessoes: { type: 'boolean' },
        timeout_ocioso_min: { type: 'integer', minimum: 1, maximum: 180 },
      } } },
    }, async (req) => {
      const b = req.body;
      if (b.gravar_sessoes !== undefined) definirConfig(db, CHAVE_GRAVAR, !!b.gravar_sessoes);
      if (b.timeout_ocioso_min !== undefined) definirConfig(db, CHAVE_TIMEOUT, b.timeout_ocioso_min);
      ctx.auditarReq(req, 'terminal_config_alterada', { detalhes: b });
      return configuracao(db);
    });

    // Transcrição gravada de um dispositivo (só existe algo aqui se gravar_sessoes esteve ligado na hora).
    app.get('/api/agentes/:id/terminal-gravacoes', { preHandler: configurar, schema: { params: PARAMS_AGENTE } }, async (req) =>
      db.prepare(`SELECT sessao_id, usuario, ts, direcao, dados FROM terminal_gravacoes WHERE agente_id = ? ORDER BY id DESC LIMIT 2000`)
        .all(req.params.id));
  },
};
