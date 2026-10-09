// Banco SQLite com o módulo nativo node:sqlite. Todas as consultas usam parâmetros.
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { SCRIPTS_EXEMPLO, REGRAS_PADRAO } from './sementes.js';

const ESQUEMA = `
CREATE TABLE IF NOT EXISTS usuarios (
  id INTEGER PRIMARY KEY,
  usuario TEXT NOT NULL UNIQUE,
  senha_hash TEXT NOT NULL,
  totp_segredo TEXT,
  totp_pendente TEXT,
  totp_ativo INTEGER NOT NULL DEFAULT 0,
  totp_ultimo_passo INTEGER NOT NULL DEFAULT -1,
  falhas INTEGER NOT NULL DEFAULT 0,
  bloqueado_ate INTEGER NOT NULL DEFAULT 0,
  criado_em INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sessoes (
  id INTEGER PRIMARY KEY,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  criado_em INTEGER NOT NULL,
  expira_em INTEGER NOT NULL,
  elevado_ate INTEGER NOT NULL DEFAULT 0,
  ip TEXT
);
CREATE TABLE IF NOT EXISTS tokens_instalacao (
  id INTEGER PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  descricao TEXT,
  criado_por TEXT NOT NULL,
  criado_em INTEGER NOT NULL,
  expira_em INTEGER NOT NULL,
  usado_em INTEGER,
  agente_id TEXT
);
CREATE TABLE IF NOT EXISTS agentes (
  id TEXT PRIMARY KEY,
  segredo_hash TEXT NOT NULL,
  hostname TEXT NOT NULL,
  so TEXT, so_versao TEXT, arquitetura TEXT, versao_agente TEXT,
  ip_local TEXT, usuario_logado TEXT,
  cpu_pct REAL, ram_usada INTEGER, ram_total INTEGER, disco_max_pct REAL,
  discos_json TEXT, uptime INTEGER,
  status TEXT NOT NULL DEFAULT 'pendente',
  revogado INTEGER NOT NULL DEFAULT 0,
  cpu_seq INTEGER NOT NULL DEFAULT 0,
  ram_seq INTEGER NOT NULL DEFAULT 0,
  inventario_json TEXT, inventario_em INTEGER,
  registrado_em INTEGER NOT NULL,
  ultimo_checkin INTEGER
);
CREATE TABLE IF NOT EXISTS metricas (
  agente_id TEXT NOT NULL REFERENCES agentes(id) ON DELETE CASCADE,
  ts INTEGER NOT NULL,
  cpu REAL, ram_pct REAL, disco_pct REAL
);
CREATE INDEX IF NOT EXISTS ix_metricas ON metricas(agente_id, ts);
CREATE TABLE IF NOT EXISTS scripts (
  id INTEGER PRIMARY KEY,
  nome TEXT NOT NULL,
  descricao TEXT NOT NULL DEFAULT '',
  shell TEXT NOT NULL,
  conteudo TEXT NOT NULL,
  timeout INTEGER NOT NULL DEFAULT 60,
  criado_em INTEGER NOT NULL,
  atualizado_em INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS jobs (
  id INTEGER PRIMARY KEY,
  agente_id TEXT NOT NULL REFERENCES agentes(id) ON DELETE CASCADE,
  script_id INTEGER,
  nome TEXT NOT NULL,
  shell TEXT NOT NULL,
  conteudo TEXT NOT NULL,
  timeout INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente',
  criado_por TEXT NOT NULL,
  criado_em INTEGER NOT NULL,
  enviado_em INTEGER,
  concluido_em INTEGER,
  codigo_saida INTEGER,
  stdout TEXT, stderr TEXT,
  duracao_ms INTEGER
);
CREATE INDEX IF NOT EXISTS ix_jobs_agente ON jobs(agente_id, status);
CREATE TABLE IF NOT EXISTS alertas (
  id INTEGER PRIMARY KEY,
  agente_id TEXT NOT NULL REFERENCES agentes(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  valor REAL,
  status TEXT NOT NULL DEFAULT 'aberto',
  aberto_em INTEGER NOT NULL,
  resolvido_em INTEGER
);
CREATE INDEX IF NOT EXISTS ix_alertas ON alertas(agente_id, tipo, status);
CREATE TABLE IF NOT EXISTS auditoria (
  id INTEGER PRIMARY KEY,
  ts INTEGER NOT NULL,
  usuario TEXT,
  acao TEXT NOT NULL,
  alvo TEXT,
  detalhes TEXT,
  ip TEXT
);
CREATE INDEX IF NOT EXISTS ix_auditoria_ts ON auditoria(ts);
CREATE TABLE IF NOT EXISTS config (
  chave TEXT PRIMARY KEY,
  valor TEXT NOT NULL
);
`;

export function abrirBanco(caminho = ':memory:') {
  if (caminho !== ':memory:') mkdirSync(dirname(caminho), { recursive: true });
  const db = new DatabaseSync(caminho);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  db.exec(ESQUEMA);
  semear(db);
  return db;
}

function semear(db) {
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM config WHERE chave = ?').get('semeado');
  if (n) return;
  const agora = Date.now();
  const ins = db.prepare(`INSERT INTO scripts (nome, descricao, shell, conteudo, timeout, criado_em, atualizado_em)
    VALUES (?, ?, ?, ?, ?, ?, ?)`);
  for (const s of SCRIPTS_EXEMPLO) ins.run(s.nome, s.descricao, s.shell, s.conteudo, s.timeout, agora, agora);
  definirConfig(db, 'regras', REGRAS_PADRAO);
  definirConfig(db, 'semeado', true);
}

export function lerConfig(db, chave, padrao = null) {
  const linha = db.prepare('SELECT valor FROM config WHERE chave = ?').get(chave);
  return linha ? JSON.parse(linha.valor) : padrao;
}

export function definirConfig(db, chave, valor) {
  db.prepare('INSERT INTO config (chave, valor) VALUES (?, ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor')
    .run(chave, JSON.stringify(valor));
}

/** Executa fn dentro de uma transação. */
export function transacao(db, fn) {
  db.exec('BEGIN');
  try {
    const r = fn();
    db.exec('COMMIT');
    return r;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}
