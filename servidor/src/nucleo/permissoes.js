// RBAC: papéis fixos (admin, tecnico, leitura) e permissões declaradas pelos módulos.
// Uma permissão é uma string "<area>.<acao>" (ex.: 'scripts.executar') e declara quais papéis a recebem.
// O papel admin tem todas as permissões, sempre.

export const PAPEIS = {
  admin: { nome: 'Administrador', descricao: 'Acesso total, inclusive usuários, regras e organização.' },
  tecnico: { nome: 'Técnico', descricao: 'Opera dispositivos: executa scripts, resolve alertas, gerencia scripts.' },
  leitura: { nome: 'Somente leitura', descricao: 'Vê dispositivos, alertas e execuções, sem alterar nada.' },
};

const FORMATO = /^[a-z][a-z0-9-]*\.[a-z][a-z0-9-.]*$/;

export class RegistroPermissoes {
  constructor() { this.mapa = new Map(); }

  /**
   * @param {string} modulo
   * @param {Record<string, {descricao: string, papeis?: string[]}>} perms
   */
  registrar(modulo, perms = {}) {
    for (const [chave, def] of Object.entries(perms)) {
      if (!FORMATO.test(chave)) throw new Error(`Permissão inválida "${chave}" (módulo ${modulo}); use "area.acao"`);
      if (this.mapa.has(chave)) throw new Error(`Permissão "${chave}" declarada duas vezes (${this.mapa.get(chave).modulo} e ${modulo})`);
      const papeis = def.papeis ?? [];
      for (const p of papeis) if (!PAPEIS[p]) throw new Error(`Permissão "${chave}": papel desconhecido "${p}"`);
      this.mapa.set(chave, { chave, modulo, descricao: def.descricao ?? chave, papeis: ['admin', ...papeis.filter((p) => p !== 'admin')] });
    }
  }

  existe(chave) { return this.mapa.has(chave); }

  /** O papel tem a permissão? Permissão não declarada é negada (exceto para admin), para não abrir buracos por erro de digitação. */
  papelTem(papel, chave) {
    if (papel === 'admin') return true;
    return this.mapa.get(chave)?.papeis.includes(papel) ?? false;
  }

  doPapel(papel) {
    return [...this.mapa.values()].filter((p) => papel === 'admin' || p.papeis.includes(papel)).map((p) => p.chave).sort();
  }

  listar() {
    return [...this.mapa.values()].sort((a, b) => a.chave.localeCompare(b.chave));
  }
}
