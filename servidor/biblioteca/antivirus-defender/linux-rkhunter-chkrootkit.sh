#!/usr/bin/env bash
# ---
# id: linux-rkhunter-chkrootkit
# nome: "Linux - verificação de rootkits"
# descricao: "Executa rkhunter ou chkrootkit (se instalados) e resume avisos."
# categoria: Antivírus e Defender
# so: [linux]
# shell: bash
# tipo: auditoria
# tempo_limite: 900
# requer_admin: true
# tags: [rootkit, seguranca]
# variaveis: []
# ---

if command -v rkhunter >/dev/null 2>&1; then rkhunter --update >/dev/null 2>&1; rkhunter --check --sk --nocolors --rwo 2>&1 | tail -25
elif command -v chkrootkit >/dev/null 2>&1; then chkrootkit 2>&1 | grep -viE 'not found|nothing found|not infected|no suspect' | head -25
else echo "Instale rkhunter ou chkrootkit."; exit 1; fi
exit 0
