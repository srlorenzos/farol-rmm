#!/usr/bin/env bash
# ---
# id: mon-linux-smart-disco
# nome: "Monitor - saúde SMART dos discos"
# descricao: "Usa smartctl para verificar o estado geral (PASSED/FAILED) de cada disco e setores realocados."
# categoria: Monitoramento
# so: [linux]
# shell: bash
# tipo: monitor
# tempo_limite: 60
# requer_admin: true
# tags: [smart, disco, monitor]
# variaveis: []
# ---
f_status() { echo "FAROL_STATUS: $1 $2"; }

command -v smartctl >/dev/null 2>&1 || { f_status alerta "smartmontools não instalado"; exit 0; }
[ "$(id -u)" -eq 0 ] || { f_status alerta "Requer root para ler SMART"; exit 0; }
ruim=""; n=0
for d in $(lsblk -dno NAME,TYPE 2>/dev/null | awk '$2=="disk" {print $1}'); do
  n=$((n+1)); r=$(smartctl -H "/dev/$d" 2>/dev/null)
  if printf '%s' "$r" | grep -qiE 'FAILED'; then ruim="$ruim $d(FAILED)"; fi
  re=$(smartctl -A "/dev/$d" 2>/dev/null | awk '/Reallocated_Sector_Ct/ {print $10}')
  [ -n "$re" ] && [ "$re" -gt 0 ] 2>/dev/null && ruim="$ruim $d(realocados=$re)"
done
if printf '%s' "$ruim" | grep -q FAILED; then f_status critico "SMART:$ruim"; elif [ -n "$ruim" ]; then f_status alerta "SMART:$ruim"; else f_status ok "$n disco(s) com SMART saudável"; fi
exit 0
