#!/usr/bin/env bash
# ---
# id: linux-inventario-software-servicos
# nome: "Linux - serviços de terceiros e aplicações detectadas"
# descricao: "Detecta stacks comuns (nginx, apache, mysql, postgres, docker, redis, mongodb, php-fpm, java, node, python apps) e suas versões."
# categoria: Inventário e auditoria
# so: [linux]
# shell: bash
# tipo: auditoria
# tempo_limite: 120
# requer_admin: false
# tags: [inventario, stack]
# variaveis: []
# ---

for c in nginx apache2 httpd mysqld mariadbd postgres redis-server mongod php-fpm php java node python3 docker podman haproxy named dovecot postfix exim4 smbd; do
  command -v "$c" >/dev/null 2>&1 && printf '%-12s %s\n' "$c" "$($c --version 2>&1 | head -1 | cut -c1-70)"
done
echo "--- Processos de aplicação"; ps -eo user,comm | awk '$1!="root" && $1!~/^(message|systemd|www-data)/ {print $2}' | sort | uniq -c | sort -rn | head -10
exit 0
