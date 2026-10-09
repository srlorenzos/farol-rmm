// Módulo de exemplo (modelo para novos módulos): mostra os dois caminhos de tempo real do Farol.
//   1. Comando tipado:  POST /api/agentes/:id/ping  → comando 'ping' → o agente responde { pong: true }
//   2. Sessão de relay: o painel abre uma sessão 'eco' pelo /api/ws e tudo o que mandar volta igual.
// Os handlers do agente ficam em agente/farol/modulos/basico.py.
import { PARAMS_AGENTE } from '../../nucleo/util.js';

export default {
  nome: 'ping',
  descricao: 'Teste de conexão em tempo real (exemplo de comando tipado e de relay)',
  depende: ['agentes'],
  // Sem permissões próprias: reaproveita 'dispositivos.ver' (declarada pelo módulo agentes).

  aoIniciar(ctx) {
    ctx.relay.registrarTipo('eco', { permissao: 'dispositivos.ver', descricao: 'Eco (teste do relay)' });
  },

  rotas(app, ctx) {
    app.post('/api/agentes/:id/ping', {
      preHandler: ctx.exigir('dispositivos.ver'),
      config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
      schema: { params: PARAMS_AGENTE },
    }, async (req) => {
      const inicio = process.hrtime.bigint();
      const { resultado } = ctx.comandos.enviar(req.params.id, 'ping', { ts: Date.now() },
        { usuario: req.sessao.usuario, fila: false, timeoutMs: 10_000 });
      const dados = await resultado;
      return { ...dados, latencia_ms: Number((process.hrtime.bigint() - inicio) / 1000n) / 1000 };
    });
  },
};
