// Migrações do núcleo. Regra de ouro: NUNCA edite nem reordene uma migração publicada — só acrescente no fim.
// A migração 1 é o esquema da v1 (com IF NOT EXISTS) para que bancos da v1 sejam atualizados sem perda.

export const MIGRACOES_NUCLEO = [
  // 1 — esquema v1 das tabelas que agora pertencem ao núcleo
  `CREATE TABLE IF NOT EXISTS config (
    chave TEXT PRIMARY KEY,
    valor TEXT NOT NULL
  );
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
  CREATE TABLE IF NOT EXISTS auditoria (
    id INTEGER PRIMARY KEY,
    ts INTEGER NOT NULL,
    usuario TEXT,
    acao TEXT NOT NULL,
    alvo TEXT,
    detalhes TEXT,
    ip TEXT
  );
  CREATE INDEX IF NOT EXISTS ix_auditoria_ts ON auditoria(ts);`,

  // 2 — v2: RBAC, clientes/sites, comandos tipados, sessões de relay, auditoria por dispositivo
  `ALTER TABLE usuarios ADD COLUMN papel TEXT NOT NULL DEFAULT 'admin';
  ALTER TABLE usuarios ADD COLUMN ativo INTEGER NOT NULL DEFAULT 1;
  ALTER TABLE usuarios ADD COLUMN nome TEXT;
  ALTER TABLE usuarios ADD COLUMN ultimo_login INTEGER;

  CREATE TABLE clientes (
    id INTEGER PRIMARY KEY,
    nome TEXT NOT NULL UNIQUE COLLATE NOCASE,
    criado_em INTEGER NOT NULL
  );
  CREATE TABLE sites (
    id INTEGER PRIMARY KEY,
    cliente_id INTEGER NOT NULL REFERENCES clientes(id) ON DELETE RESTRICT,
    nome TEXT NOT NULL COLLATE NOCASE,
    criado_em INTEGER NOT NULL,
    UNIQUE (cliente_id, nome)
  );
  INSERT INTO clientes (id, nome, criado_em) VALUES (1, 'Minha empresa', CAST(unixepoch('subsec') * 1000 AS INTEGER));
  INSERT INTO sites (id, cliente_id, nome, criado_em) VALUES (1, 1, 'Minha empresa', CAST(unixepoch('subsec') * 1000 AS INTEGER));

  ALTER TABLE agentes ADD COLUMN site_id INTEGER NOT NULL DEFAULT 1;
  ALTER TABLE agentes ADD COLUMN capacidades_json TEXT;
  ALTER TABLE agentes ADD COLUMN descricao TEXT;
  CREATE INDEX ix_agentes_site ON agentes(site_id);
  ALTER TABLE tokens_instalacao ADD COLUMN site_id INTEGER NOT NULL DEFAULT 1;

  ALTER TABLE auditoria ADD COLUMN agente_id TEXT;
  CREATE INDEX ix_auditoria_agente ON auditoria(agente_id, id);

  CREATE TABLE comandos (
    id INTEGER PRIMARY KEY,
    agente_id TEXT NOT NULL REFERENCES agentes(id) ON DELETE CASCADE,
    tipo TEXT NOT NULL,
    args_json TEXT NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'pendente',
    criado_por TEXT,
    criado_em INTEGER NOT NULL,
    enviado_em INTEGER,
    concluido_em INTEGER,
    expira_em INTEGER NOT NULL,
    resultado_json TEXT,
    erro TEXT
  );
  CREATE INDEX ix_comandos_agente ON comandos(agente_id, status);

  CREATE TABLE relay_sessoes (
    id TEXT PRIMARY KEY,
    agente_id TEXT NOT NULL REFERENCES agentes(id) ON DELETE CASCADE,
    tipo TEXT NOT NULL,
    usuario TEXT NOT NULL,
    ip TEXT,
    aberta_em INTEGER NOT NULL,
    fechada_em INTEGER,
    bytes_painel INTEGER NOT NULL DEFAULT 0,
    bytes_agente INTEGER NOT NULL DEFAULT 0,
    motivo TEXT
  );`,
];
