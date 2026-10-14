// Banco SQLite com o módulo nativo node:sqlite. Todas as consultas usam parâmetros.
// O esquema é criado pelas migrações (núcleo + módulos) — veja nucleo/migracoes.js.
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export function abrirBanco(caminho = ':memory:') {
  if (caminho !== ':memory:') mkdirSync(dirname(caminho), { recursive: true });
  const db = new DatabaseSync(caminho);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000; PRAGMA synchronous = NORMAL;');
  return db;
}

export function lerConfig(db, chave, padrao = null) {
  const linha = db.prepare('SELECT valor FROM config WHERE chave = ?').get(chave);
  return linha ? JSON.parse(linha.valor) : padrao;
}

export function definirConfig(db, chave, valor) {
  db.prepare('INSERT INTO config (chave, valor) VALUES (?, ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor')
    .run(chave, JSON.stringify(valor));
}

/** Executa fn dentro de uma transação (aninhamento vira SAVEPOINT). */
let profundidade = 0;
export function transacao(db, fn) {
  const nome = `sp${profundidade}`;
  db.exec(profundidade ? `SAVEPOINT ${nome}` : 'BEGIN');
  profundidade++;
  try {
    const r = fn();
    profundidade--;
    db.exec(profundidade ? `RELEASE ${nome}` : 'COMMIT');
    return r;
  } catch (e) {
    profundidade--;
    db.exec(profundidade ? `ROLLBACK TO ${nome}; RELEASE ${nome}` : 'ROLLBACK');
    throw e;
  }
}

/** Lista de "?" para cláusulas IN. */
export const marcadores = (n) => Array.from({ length: n }, () => '?').join(',');
