#!/usr/bin/env bash
# ---
# id: nginx-resumo-sites
# nome: "nginx - sites, portas e certificados configurados"
# descricao: "Lista server_name, portas de escuta e caminhos de certificados SSL de todos os arquivos de configuração."
# categoria: Servidores Linux
# so: [linux]
# shell: bash
# tipo: auditoria
# tempo_limite: 120
# requer_admin: false
# tags: [nginx, web]
# variaveis: []
# ---

command -v nginx >/dev/null 2>&1 || { echo "nginx não instalado."; exit 1; }
nginx -T 2>/dev/null | grep -E '^\s*(server_name|listen|ssl_certificate |root|proxy_pass)\s' | sed 's/^ *//' | sort | uniq -c | sort -rn | head -60
exit 0
