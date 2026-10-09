#!/usr/bin/env bash
# ---
# id: ufw-status-e-regras
# nome: "UFW - status e regras"
# descricao: "Mostra o estado do UFW com regras numeradas."
# categoria: Servidores Linux
# so: [linux]
# shell: bash
# tipo: auditoria
# tempo_limite: 120
# requer_admin: true
# tags: [ufw, firewall]
# variaveis: []
# ---

command -v ufw >/dev/null 2>&1 || { echo "UFW não instalado."; exit 1; }
ufw status verbose
ufw status numbered
exit 0
