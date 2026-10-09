#!/usr/bin/env bash
# ---
# id: firewalld-status-e-regras
# nome: "firewalld - zonas, serviços e portas abertas"
# descricao: "Mostra zona padrão, interfaces, serviços e portas liberadas no firewalld."
# categoria: Servidores Linux
# so: [linux]
# shell: bash
# tipo: auditoria
# tempo_limite: 120
# requer_admin: true
# tags: [firewalld, firewall]
# variaveis: []
# ---

command -v firewall-cmd >/dev/null 2>&1 || { echo "firewalld não instalado."; exit 1; }
firewall-cmd --state
firewall-cmd --get-default-zone
firewall-cmd --list-all-zones 2>/dev/null | awk '/\(active\)/ {p=1} /^[a-z]/ && !/\(active\)/ {p=0} p'
exit 0
