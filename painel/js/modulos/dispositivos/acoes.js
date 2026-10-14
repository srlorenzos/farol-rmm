// Ações de dispositivo vindas do registro → itens de menu (linha da tabela, menu de contexto, "Mais" do detalhe).
import { registro, visiveis } from '../../nucleo/registro.js';

export function acoesDisponiveis(agente) {
  return visiveis(registro.acoesDispositivo).filter((a) => !a.disponivel || a.disponivel(agente));
}

export function itensAcoes(agente, ctx = {}) {
  const itens = [{ rotulo: 'Abrir detalhes', icone: 'seta', href: `#/dispositivos/${agente.id}` }, '-'];
  let perigo = false;
  for (const a of acoesDisponiveis(agente)) {
    if (a.perigo && !perigo) { itens.push('-'); perigo = true; }
    itens.push({
      rotulo: a.rotulo, icone: a.icone, perigo: a.perigo, desabilitado: a.emBreve, dica: a.emBreve ? 'Disponível em breve' : null,
      atalho: a.emBreve ? 'em breve' : null, onclick: () => a.executar?.(agente, ctx),
    });
  }
  return itens;
}
