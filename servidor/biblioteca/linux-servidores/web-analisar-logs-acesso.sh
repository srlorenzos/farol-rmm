#!/usr/bin/env bash
# ---
# id: web-analisar-logs-acesso
# nome: "Web - análise rápida dos logs de acesso"
# descricao: "Resume os logs de acesso do nginx/Apache: top IPs, top URLs, códigos de status e erros 5xx."
# categoria: Servidores Linux
# so: [linux]
# shell: bash
# tipo: auditoria
# tempo_limite: 120
# requer_admin: false
# tags: [web, logs]
# variaveis:
#   - nome: ARQUIVO
#     rotulo: "Log de acesso"
#     tipo: texto
#     padrao: "/var/log/nginx/access.log"
#     obrigatorio: false
#     opcoes: []
#   - nome: LINHAS
#     rotulo: "Últimas N linhas a analisar"
#     tipo: numero
#     padrao: 50000
#     obrigatorio: false
#     opcoes: []
# ---
f_num() { case "$1" in ''|*[!0-9]*) echo "$2";; *) echo "$1";; esac; }

f="${FAROL_ARQUIVO:-/var/log/nginx/access.log}"; n=$(f_num "$FAROL_LINHAS" 50000)
[ -r "$f" ] || { for alt in /var/log/apache2/access.log /var/log/httpd/access_log; do [ -r "$alt" ] && f=$alt; done; }
[ -r "$f" ] || { echo "Log não encontrado/legível."; exit 1; }
echo "Arquivo: $f"; t=$(tail -n "$n" "$f")
echo "== Top 10 IPs =="; printf '%s\n' "$t" | awk '{print $1}' | sort | uniq -c | sort -rn | head -10
echo "== Top 10 URLs =="; printf '%s\n' "$t" | awk '{print $7}' | sort | uniq -c | sort -rn | head -10
echo "== Códigos de status =="; printf '%s\n' "$t" | awk '{print $9}' | grep -E '^[0-9]{3}$' | sort | uniq -c | sort -rn
exit 0
