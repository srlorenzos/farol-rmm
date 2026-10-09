#!/usr/bin/env bash
# ---
# id: mon-linux-temperatura
# nome: "Monitor - temperatura (sensores)"
# descricao: "Lê temperaturas de /sys/class/thermal ou lm-sensors e alerta pelos limites."
# categoria: Monitoramento
# so: [linux]
# shell: bash
# tipo: monitor
# tempo_limite: 60
# requer_admin: false
# tags: [temperatura, hardware, monitor]
# variaveis:
#   - nome: ALERTA
#     rotulo: "Alerta (C)"
#     tipo: numero
#     padrao: 75
#     obrigatorio: false
#     opcoes: []
#   - nome: CRITICO
#     rotulo: "Crítico (C)"
#     tipo: numero
#     padrao: 90
#     obrigatorio: false
#     opcoes: []
# ---
f_num() { case "$1" in ''|*[!0-9]*) echo "$2";; *) echo "$1";; esac; }
f_status() { echo "FAROL_STATUS: $1 $2"; }

a=$(f_num "$FAROL_ALERTA" 75); c=$(f_num "$FAROL_CRITICO" 90)
max=0
for z in /sys/class/thermal/thermal_zone*/temp; do [ -r "$z" ] || continue; t=$(( $(cat "$z") / 1000 )); [ "$t" -gt "$max" ] && max=$t; done
if [ "$max" -eq 0 ] && command -v sensors >/dev/null 2>&1; then max=$(sensors 2>/dev/null | grep -oE '\+[0-9]+(\.[0-9])?°C' | tr -d '+°C' | awk '{printf "%d\n", $1}' | sort -n | tail -1); max=${max:-0}; fi
[ "$max" -eq 0 ] && { f_status ok "Sem sensores de temperatura disponíveis"; exit 0; }
msg="Temperatura máxima ${max} C"
if [ "$max" -ge "$c" ]; then f_status critico "$msg"; elif [ "$max" -ge "$a" ]; then f_status alerta "$msg"; else f_status ok "$msg"; fi
exit 0
