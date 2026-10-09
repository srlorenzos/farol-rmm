// Descoberta e ordenação dos módulos do servidor (src/modulos/<nome>/index.js).
// Ordem determinística: topológica pelas dependências (`depende`), com desempate alfabético.
import { readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const NOME_VALIDO = /^[a-z][a-z0-9-]*$/;
const CHAVES = new Set(['nome', 'descricao', 'depende', 'migracoes', 'permissoes', 'rotas', 'aoIniciar', 'aoCheckin', 'tarefasAgente', 'servico', 'eventos']);

export async function descobrirModulos(pasta, { ignorar = [] } = {}) {
  if (!existsSync(pasta)) return [];
  const pastas = readdirSync(pasta, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('_') && !d.name.startsWith('.') && !ignorar.includes(d.name))
    .map((d) => d.name)
    .sort();
  const modulos = [];
  for (const nome of pastas) {
    const arquivo = join(pasta, nome, 'index.js');
    if (!existsSync(arquivo)) continue;
    const mod = (await import(pathToFileURL(arquivo).href)).default;
    validarModulo(mod, nome);
    modulos.push(mod);
  }
  return ordenarModulos(modulos);
}

export function validarModulo(mod, pastaNome) {
  if (!mod || typeof mod !== 'object') throw new Error(`Módulo "${pastaNome}": index.js precisa de "export default { nome, ... }"`);
  if (!NOME_VALIDO.test(mod.nome ?? '')) throw new Error(`Módulo "${pastaNome}": nome inválido "${mod.nome}"`);
  if (pastaNome && mod.nome !== pastaNome) throw new Error(`Módulo "${pastaNome}": o nome exportado ("${mod.nome}") deve ser igual ao da pasta`);
  for (const k of Object.keys(mod)) {
    if (!CHAVES.has(k)) throw new Error(`Módulo "${mod.nome}": chave desconhecida "${k}" (válidas: ${[...CHAVES].join(', ')})`);
  }
  if (mod.migracoes && !Array.isArray(mod.migracoes)) throw new Error(`Módulo "${mod.nome}": migracoes deve ser uma lista`);
  for (const f of ['rotas', 'aoIniciar', 'aoCheckin', 'tarefasAgente', 'servico']) {
    if (mod[f] != null && typeof mod[f] !== 'function') throw new Error(`Módulo "${mod.nome}": ${f} deve ser função`);
  }
}

/** Ordenação topológica estável (Kahn com fila ordenada por nome). */
export function ordenarModulos(modulos) {
  const porNome = new Map(modulos.map((m) => [m.nome, m]));
  if (porNome.size !== modulos.length) throw new Error('Há dois módulos com o mesmo nome');
  const pendentes = new Map();
  for (const m of modulos) {
    const deps = m.depende ?? [];
    for (const d of deps) if (!porNome.has(d)) throw new Error(`Módulo "${m.nome}" depende de "${d}", que não existe`);
    pendentes.set(m.nome, new Set(deps));
  }
  const ordem = [];
  while (pendentes.size) {
    const prontos = [...pendentes].filter(([, deps]) => deps.size === 0).map(([n]) => n).sort();
    if (!prontos.length) throw new Error(`Dependência circular entre módulos: ${[...pendentes.keys()].join(', ')}`);
    const n = prontos[0];
    ordem.push(porNome.get(n));
    pendentes.delete(n);
    for (const deps of pendentes.values()) deps.delete(n);
  }
  return ordem;
}
