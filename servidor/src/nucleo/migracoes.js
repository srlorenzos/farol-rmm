// Migrações versionadas por módulo. Cada módulo exporta `migracoes: [...]`; a versão é a posição (1, 2, 3…).
// Uma migração é SQL (string) ou uma função (db, ctx) => void. Cada uma roda numa transação própria.
import { transacao } from '../db.js';

export function garantirTabelaMigracoes(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS farol_migracoes (
    modulo TEXT NOT NULL,
    versao INTEGER NOT NULL,
    aplicada_em INTEGER NOT NULL,
    PRIMARY KEY (modulo, versao)
  )`);
}

export function versaoAtual(db, modulo) {
  return db.prepare('SELECT COALESCE(MAX(versao), 0) AS v FROM farol_migracoes WHERE modulo = ?').get(modulo).v;
}

/** Aplica as migrações pendentes do módulo. Devolve quantas foram aplicadas. */
export function aplicarMigracoes(db, modulo, migracoes = [], ctx = null) {
  garantirTabelaMigracoes(db);
  const atual = versaoAtual(db, modulo);
  if (atual > migracoes.length) {
    throw new Error(`Banco tem a migração ${atual} do módulo "${modulo}", mas o código só conhece ${migracoes.length}. Atualize o servidor.`);
  }
  let aplicadas = 0;
  for (let i = atual; i < migracoes.length; i++) {
    const m = migracoes[i];
    transacao(db, () => {
      try {
        if (typeof m === 'function') m(db, ctx);
        else db.exec(m);
      } catch (e) {
        e.message = `Migração ${i + 1} do módulo "${modulo}" falhou: ${e.message}`;
        throw e;
      }
      db.prepare('INSERT INTO farol_migracoes (modulo, versao, aplicada_em) VALUES (?, ?, ?)').run(modulo, i + 1, Date.now());
    });
    aplicadas++;
  }
  return aplicadas;
}
