#!/usr/bin/env bash
# ---
# id: linux-backup-banco-dados
# nome: "Linux - dump de banco PostgreSQL ou MySQL"
# descricao: "Gera dump comprimido de um banco (pg_dump ou mysqldump) usando a conta do sistema, e rotaciona os antigos."
# categoria: Backup e recuperação
# so: [linux]
# shell: bash
# tipo: acao
# tempo_limite: 7200
# requer_admin: true
# tags: [banco-de-dados, dump, backup]
# variaveis:
#   - nome: TIPO
#     rotulo: "Tipo de banco"
#     tipo: selecao
#     padrao: "postgres"
#     obrigatorio: true
#     opcoes: [postgres, mysql]
#   - nome: BANCO
#     rotulo: "Nome do banco (vazio = todos)"
#     tipo: texto
#     padrao: ""
#     obrigatorio: false
#     opcoes: []
#   - nome: DESTINO
#     rotulo: "Pasta de destino"
#     tipo: texto
#     padrao: "/var/backups/db"
#     obrigatorio: false
#     opcoes: []
#   - nome: MANTER
#     rotulo: "Dumps a manter"
#     tipo: numero
#     padrao: 7
#     obrigatorio: false
#     opcoes: []
# ---
f_num() { case "$1" in ''|*[!0-9]*) echo "$2";; *) echo "$1";; esac; }
f_root() { [ "$(id -u)" -eq 0 ] || { echo "ERRO: execute como root."; exit 1; }; }
f_nome_ok() { printf '%s' "$1" | grep -Eq '^[A-Za-z0-9][A-Za-z0-9._+:@-]*$'; }

f_root
b="$FAROL_BANCO"; d="${FAROL_DESTINO:-/var/backups/db}"; k=$(f_num "$FAROL_MANTER" 7)
[ -z "$b" ] || f_nome_ok "$b" || { echo "Nome de banco inválido."; exit 1; }
printf '%s' "$d" | grep -Eq '^/[A-Za-z0-9._/ -]+$' || { echo "Destino inválido."; exit 1; }
mkdir -p "$d"; chmod 700 "$d"; ts=$(date +%Y%m%d-%H%M); alvo="${b:-todos}"
case "$FAROL_TIPO" in
  postgres) command -v pg_dump >/dev/null 2>&1 || { echo "pg_dump ausente."; exit 1; }
    if [ -n "$b" ]; then su - postgres -c "pg_dump $b" | gzip > "$d/pg-$alvo-$ts.sql.gz"; else su - postgres -c "pg_dumpall" | gzip > "$d/pg-$alvo-$ts.sql.gz"; fi;;
  mysql) command -v mysqldump >/dev/null 2>&1 || { echo "mysqldump ausente."; exit 1; }
    if [ -n "$b" ]; then mysqldump --single-transaction "$b" | gzip > "$d/my-$alvo-$ts.sql.gz"; else mysqldump --single-transaction --all-databases | gzip > "$d/my-$alvo-$ts.sql.gz"; fi;;
esac
ls -lh "$d" | tail -3
ls -1t "$d"/*-"$alvo"-*.sql.gz 2>/dev/null | tail -n +$((k+1)) | xargs -r rm -f
exit 0
