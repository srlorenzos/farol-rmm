// Tela remota: registra o tipo de sessão de relay 'tela' (visualização + controle de mouse/teclado).
// Abertura, fechamento, permissão, 2FA e auditoria já são genéricos do núcleo (ver src/nucleo/relay.js) —
// este módulo só acrescenta a permissão 'tela.usar' e o limite de 1 sessão simultânea por dispositivo
// (maxPorAgente: evita duas pessoas disputando o mouse do mesmo computador ao mesmo tempo).
// O lado do agente fica em agente/farol/modulos/tela.py (classe Tela, sessão 'tela').
export default {
  nome: 'tela',
  descricao: 'Tela remota com controle de mouse/teclado (sessão de relay sobre o canal em tempo real do agente)',
  depende: ['agentes'],
  permissoes: {
    'tela.usar': { descricao: 'Abrir tela remota (visualização e controle) nos dispositivos', papeis: ['tecnico'] },
  },

  aoIniciar(ctx) {
    ctx.relay.registrarTipo('tela', {
      permissao: 'tela.usar',
      elevado: true,
      descricao: 'Tela remota',
      maxPorAgente: 1,
      // Avisa a bandeja do dispositivo (se estiver rodando — fila/best-effort, nunca bloqueia a sessão)
      // que alguém está vendo/controlando a tela agora. Mesmo mecanismo de 'chamados.notificar': comando
      // tipado comum, a bandeja descobre lendo GET /api/notificacoes no próximo poll (até ~10 s).
      aoAbrir: (s) => ctx.comandos.enviar(s.agenteId, 'tela.notificar', { usuario: s.usuario }, { fila: false, timeoutMs: 5000 }),
    });
  },
};
