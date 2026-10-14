// Módulo Agendamentos: rodar um script (seu ou da biblioteca) de tempos em tempos ou por expressão cron,
// num alvo (todos, cliente, site ou um dispositivo). Backend: servidor/src/modulos/agendamentos/index.js —
// o disparo em si é sempre feito pelo mesmo caminho da execução manual (POST /api/executar), então o que
// aparece aqui depois de rodar é idêntico ao que aparece em Automação → Execuções.
import { paginaAgendamentos } from './lista.js';
import { abrirAgendamentoModal } from './modal.js';

export { abrirAgendamentoModal };

export default {
  nome: 'agendamentos',
  iniciar(farol) {
    farol.menu({ id: 'agendamentos', rotulo: 'Agendamentos', icone: 'relogio', secao: 'Automação', ordem: 25, href: '#/agendamentos', permissao: 'agendamentos.ver' });
    farol.rota('/agendamentos', { titulo: 'Agendamentos', permissao: 'agendamentos.ver', render: paginaAgendamentos });
    farol.comando({
      id: 'novo-agendamento', rotulo: 'Novo agendamento', descricao: 'Rodar um script periodicamente ou por cron', icone: 'mais',
      palavras: 'agendar cron intervalo periodico tarefa automatico', permissao: 'agendamentos.gerenciar',
      executar: () => abrirAgendamentoModal({}),
    });
  },
};
