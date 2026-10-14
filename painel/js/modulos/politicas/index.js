// Módulo Políticas: pacote nomeado de exceções de alerta + moldes de agendamento, aplicado de uma vez a um
// alvo (dispositivo, site, cliente, todos ou grupo dinâmico). Backend: servidor/src/modulos/politicas —
// "aplicar" só reaproveita alertas.definirOverride() e agendamentos.criar()/atualizar(), nunca reinventa.
import { paginaPoliticas } from './lista.js';
import { abrirPoliticaModal } from './modal.js';

export { abrirPoliticaModal };

export default {
  nome: 'politicas',
  iniciar(farol) {
    farol.menu({ id: 'politicas', rotulo: 'Políticas', icone: 'escudo', secao: 'Automação', ordem: 27, href: '#/politicas', permissao: 'politicas.ver' });
    farol.rota('/politicas', { titulo: 'Políticas', permissao: 'politicas.ver', render: paginaPoliticas });
    farol.comando({
      id: 'nova-politica', rotulo: 'Nova política', descricao: 'Exceções de alerta + agendamentos aplicados de uma vez', icone: 'mais',
      palavras: 'bundle regras overrides agendamentos site grupo', permissao: 'politicas.gerenciar', executar: () => abrirPoliticaModal({}),
    });
  },
};
