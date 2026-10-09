#!/usr/bin/env bash
# ---
# id: mdadm-status-detalhado
# nome: "mdadm - status dos arrays RAID"
# descricao: "Mostra /proc/mdstat e detalhes (mdadm --detail) de cada array, incluindo discos falhos."
# categoria: Servidores Linux
# so: [linux]
# shell: bash
# tipo: auditoria
# tempo_limite: 120
# requer_admin: true
# tags: [mdadm, raid]
# variaveis: []
# ---

cat /proc/mdstat 2>/dev/null
command -v mdadm >/dev/null 2>&1 || { echo "mdadm não instalado."; exit 0; }
for a in /dev/md*; do [ -b "$a" ] && { echo "=== $a"; mdadm --detail "$a" | grep -E 'State|Active|Failed|Working|Spare|UUID|Level|Array Size'; }; done
exit 0
