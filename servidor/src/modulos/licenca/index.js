// Licença: valida offline a chave Ed25519 colada pelo administrador e aplica o limite de dispositivos.
// Sem licença, o servidor funciona até 5 dispositivos. Ponto de extensão usado pelo módulo agentes no registro:
// (config.licencaChavePublica existe só para testes.)
//   ctx.servicos.licenca.verificarRegistro() -> string com o motivo da recusa, ou null.
import { lerConfig, definirConfig } from '../../db.js';
import { verificar, situacao, LIMITE_GRATIS, CARENCIA_DIAS, AVISO_DIAS } from './chave.js';

const CHAVE_CFG = 'licenca_chave';

export default {
  nome: 'licenca',
  descricao: 'Licença do produto e limite de dispositivos',
  depende: ['agentes'],
  permissoes: {
    'licenca.ver': { descricao: 'Ver a licença e o uso de dispositivos', papeis: ['tecnico', 'leitura'] },
    'licenca.gerenciar': { descricao: 'Instalar ou remover a chave de licença' },
  },

  servico(ctx) {
    const usados = () => ctx.db.prepare('SELECT COUNT(*) AS n FROM agentes WHERE revogado = 0').get().n;
    const lerLicenca = () => {
      const texto = lerConfig(ctx.db, CHAVE_CFG, null);
      if (!texto) return { licenca: null, invalida: null };
      const r = verificar(texto, { chavePublica: ctx.config.licencaChavePublica });
      return r.ok ? { licenca: r.licenca, invalida: null } : { licenca: null, invalida: r.erro };
    };
    const estado = (agora = Date.now()) => {
      const { licenca, invalida } = lerLicenca();
      const s = situacao(licenca, agora);
      const n = usados();
      return {
        ...s, invalida, usados: n,
        cliente: licenca?.cliente ?? null, email: licenca?.email ?? null, id: licenca?.id ?? null,
        emitida_em: licenca?.emitida_em ?? null,
        limite_gratis: LIMITE_GRATIS, carencia_dias: CARENCIA_DIAS, aviso_dias: AVISO_DIAS,
        perto_do_limite: !s.ilimitado && s.limite != null && n >= s.limite - 1,
      };
    };
    return {
      estado,
      /** null se pode registrar mais um dispositivo; senão a mensagem de recusa. */
      verificarRegistro(agora = Date.now()) {
        const e = estado(agora);
        if (e.ilimitado || e.usados < e.limite) return null;
        return e.estado === 'gratis' || e.estado === 'expirada'
          ? `Limite de ${e.limite} dispositivos do plano grátis atingido (${e.usados} em uso). Instale uma licença em Configurações → Licença para adicionar mais.`
          : `Limite de ${e.limite} dispositivos da licença atingido (${e.usados} em uso). Faça upgrade do plano ou revogue dispositivos que não usa mais.`;
      },
    };
  },

  rotas(app, ctx) {
    const svc = () => ctx.servicos.licenca;
    app.get('/api/licenca', { preHandler: ctx.exigir('licenca.ver') }, async () => svc().estado());

    app.put('/api/licenca', {
      preHandler: ctx.exigir('licenca.gerenciar'),
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
      schema: { body: { type: 'object', required: ['chave'], additionalProperties: false, properties: { chave: { type: 'string', minLength: 20, maxLength: 4096 } } } },
    }, async (req, reply) => {
      const r = verificar(req.body.chave, { chavePublica: ctx.config.licencaChavePublica });
      if (!r.ok) {
        ctx.auditarReq(req, 'licenca_recusada', { detalhes: r.erro });
        return reply.code(400).send({ erro: r.erro });
      }
      definirConfig(ctx.db, CHAVE_CFG, req.body.chave.trim().replace(/\s+/g, ''));
      ctx.auditarReq(req, 'licenca_instalada', { alvo: r.licenca.id, detalhes: `${r.licenca.cliente} · plano ${r.licenca.plano}` });
      ctx.emitir('licenca', {});
      return svc().estado();
    });

    app.delete('/api/licenca', { preHandler: ctx.exigir('licenca.gerenciar') }, async (req) => {
      definirConfig(ctx.db, CHAVE_CFG, null);
      ctx.auditarReq(req, 'licenca_removida');
      ctx.emitir('licenca', {});
      return svc().estado();
    });
  },
};
