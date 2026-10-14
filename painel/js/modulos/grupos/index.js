// Módulo Grupos: grupos dinâmicos por filtro (nunca por lista de membros — ver servidor/src/modulos/grupos),
// campos personalizados (UDFs) configuráveis em Configurações, e a aba "Campos" no detalhe do dispositivo
// pra editar tags e os valores desses campos.
import { paginaGrupos } from './lista.js';
import { abrirGrupoModal } from './modal.js';
import { secaoCampos, abaCampos } from './campos.js';

export { abrirGrupoModal };

export default {
  nome: 'grupos',
  iniciar(farol) {
    farol.menu({ id: 'grupos', rotulo: 'Grupos', icone: 'grupo', secao: 'Gerenciar', ordem: 30, href: '#/grupos', permissao: 'grupos.ver' });
    farol.rota('/grupos', { titulo: 'Grupos', permissao: 'grupos.ver', render: paginaGrupos });
    farol.abaDispositivo({ id: 'campos', rotulo: 'Campos', icone: 'colunas', ordem: 45, render: abaCampos });
    farol.secaoConfig({
      id: 'campos-personalizados', rotulo: 'Campos personalizados', icone: 'colunas', ordem: 60,
      descricao: 'Campos (UDFs) para classificar dispositivos — centro de custo, criticidade, filial... — usáveis em grupos dinâmicos.',
      render: secaoCampos,
    });
    farol.comando({ id: 'novo-grupo', rotulo: 'Novo grupo dinâmico', icone: 'mais', palavras: 'filtro udf tag campo personalizado', permissao: 'grupos.gerenciar', executar: () => abrirGrupoModal({}) });
  },
};
