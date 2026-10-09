// Alvos reutilizáveis: { tipo: 'agente'|'site'|'cliente'|'grupo'|'filtro'|'todos', id }.
// O núcleo resolve agente, site, cliente e todos. Outros módulos registram resolvedores novos
// (ex.: o módulo de grupos registra 'grupo' e 'filtro') com ctx.alvos.registrar(tipo, fn).
// Um resolvedor recebe (id, ctx) e devolve uma lista de IDs de agentes (ou uma Promise dela).
import { marcadores } from '../db.js';

export class ErroAlvo extends Error {
  constructor(msg) { super(msg); this.statusCode = 400; }
}

const COLUNAS = 'a.id, a.hostname, a.so, a.status, a.site_id, a.capacidades_json';

export class ResolvedorAlvos {
  constructor(ctx) {
    this.ctx = ctx;
    this.resolvedores = new Map();
    const { db } = ctx;
    this.registrar('agente', (id) => {
      const ids = Array.isArray(id) ? id : [id];
      if (!ids.every((x) => typeof x === 'string' && /^[0-9a-f-]{36}$/.test(x))) throw new ErroAlvo('ID de agente inválido');
      return ids;
    }, { descricao: 'Um dispositivo (ou lista de dispositivos)' });
    this.registrar('site', (id) => db.prepare('SELECT id FROM agentes WHERE site_id = ? AND revogado = 0').all(inteiro(id)).map((r) => r.id),
      { descricao: 'Todos os dispositivos de um site' });
    this.registrar('cliente', (id) => db.prepare(`SELECT a.id FROM agentes a JOIN sites s ON s.id = a.site_id
      WHERE s.cliente_id = ? AND a.revogado = 0`).all(inteiro(id)).map((r) => r.id), { descricao: 'Todos os dispositivos de um cliente' });
    this.registrar('todos', () => db.prepare('SELECT id FROM agentes WHERE revogado = 0').all().map((r) => r.id),
      { descricao: 'Todos os dispositivos' });
  }

  registrar(tipo, fn, { descricao = tipo } = {}) {
    if (!/^[a-z][a-z0-9-]*$/.test(tipo)) throw new Error(`Tipo de alvo inválido "${tipo}"`);
    if (this.resolvedores.has(tipo)) throw new Error(`Resolvedor de alvo "${tipo}" já registrado`);
    this.resolvedores.set(tipo, { fn, descricao });
  }

  tipos() {
    return [...this.resolvedores].map(([tipo, r]) => ({ tipo, descricao: r.descricao }));
  }

  /**
   * Resolve um alvo (ou lista de alvos) numa lista de agentes ativos, sem duplicatas,
   * ordenada por hostname. Agentes revogados ou inexistentes são descartados.
   */
  async resolver(alvo) {
    const lista = Array.isArray(alvo) ? alvo : [alvo];
    const ids = new Set();
    for (const a of lista) {
      if (!a || typeof a !== 'object') throw new ErroAlvo('Alvo inválido');
      const r = this.resolvedores.get(a.tipo);
      if (!r) throw new ErroAlvo(`Tipo de alvo desconhecido: ${a.tipo}`);
      for (const id of await r.fn(a.id, this.ctx)) ids.add(id);
    }
    if (!ids.size) return [];
    const todos = [...ids];
    const agentes = [];
    for (let i = 0; i < todos.length; i += 500) {
      const parte = todos.slice(i, i + 500);
      agentes.push(...this.ctx.db.prepare(`SELECT ${COLUNAS} FROM agentes a WHERE a.revogado = 0 AND a.id IN (${marcadores(parte.length)})`).all(...parte));
    }
    return agentes.sort((x, y) => x.hostname.localeCompare(y.hostname, 'pt-BR'));
  }
}

function inteiro(v) {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1) throw new ErroAlvo('ID inválido no alvo');
  return n;
}
