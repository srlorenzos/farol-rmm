#!/usr/bin/env bash
# ---
# id: postgresql-mysql-status
# nome: "Bancos de dados - status PostgreSQL e MySQL/MariaDB"
# descricao: "Verifica serviços, versões e conexões ativas de PostgreSQL e MySQL/MariaDB quando instalados."
# categoria: Servidores Linux
# so: [linux]
# shell: bash
# tipo: auditoria
# tempo_limite: 120
# requer_admin: true
# tags: [banco-de-dados, postgres, mysql]
# variaveis: []
# ---

for s in postgresql mysql mysqld mariadb; do systemctl list-unit-files "$s.service" >/dev/null 2>&1 && systemctl cat "$s" >/dev/null 2>&1 && printf '%-12s %s\n' "$s" "$(systemctl is-active "$s")"; done
command -v psql >/dev/null 2>&1 && { echo "PostgreSQL: $(psql --version)"; su - postgres -c "psql -Atc \"select count(*) || ' conexão(ões)' from pg_stat_activity\"" 2>/dev/null; }
command -v mysql >/dev/null 2>&1 && { echo "MySQL: $(mysql --version)"; mysqladmin status 2>/dev/null; }
exit 0
