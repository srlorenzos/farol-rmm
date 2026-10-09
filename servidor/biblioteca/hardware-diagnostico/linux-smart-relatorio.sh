#!/usr/bin/env bash
# ---
# id: linux-smart-relatorio
# nome: "Linux - relatório SMART dos discos"
# descricao: "Exibe saúde, horas ligado, temperatura e setores realocados de cada disco via smartctl."
# categoria: Hardware e diagnóstico
# so: [linux]
# shell: bash
# tipo: auditoria
# tempo_limite: 120
# requer_admin: true
# tags: [smart, disco]
# variaveis: []
# ---

command -v smartctl >/dev/null 2>&1 || { echo "smartmontools não instalado (instale smartmontools)."; exit 1; }
for d in $(lsblk -dno NAME,TYPE | awk '$2=="disk" {print $1}'); do
  echo "=== /dev/$d"; smartctl -i "/dev/$d" | grep -E 'Model|Serial|Capacity'; smartctl -H "/dev/$d" | grep -i 'overall\|result'
  smartctl -A "/dev/$d" | grep -E 'Reallocated|Power_On_Hours|Temperature|Wear|Percentage Used|Pending'
done
exit 0
