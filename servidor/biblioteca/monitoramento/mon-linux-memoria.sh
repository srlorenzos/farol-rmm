#!/usr/bin/env bash
# ---
# id: mon-linux-memoria
# nome: "Monitor - uso de memória"
# descricao: "Avalia memória disponível (MemAvailable) e uso de swap."
# categoria: Monitoramento
# so: [linux]
# shell: bash
# tipo: monitor
# tempo_limite: 60
# requer_admin: false
# tags: [memoria, monitor]
# variaveis:
#   - nome: ALERTA
#     rotulo: "Alerta (% em uso)"
#     tipo: numero
#     padrao: 85
#     obrigatorio: false
#     opcoes: []
#   - nome: CRITICO
#     rotulo: "Crítico (% em uso)"
#     tipo: numero
#     padrao: 95
#     obrigatorio: false
#     opcoes: []
# ---
f_num() { case "$1" in ''|*[!0-9]*) echo "$2";; *) echo "$1";; esac; }
f_status() { echo "FAROL_STATUS: $1 $2"; }

a=$(f_num "$FAROL_ALERTA" 85); c=$(f_num "$FAROL_CRITICO" 95)
tot=$(awk '/^MemTotal/ {print $2}' /proc/meminfo); disp=$(awk '/^MemAvailable/ {print $2}' /proc/meminfo)
st=$(awk '/^SwapTotal/ {print $2}' /proc/meminfo); sf=$(awk '/^SwapFree/ {print $2}' /proc/meminfo)
uso=$(( (tot - disp) * 100 / tot ))
swap=0; [ "$st" -gt 0 ] && swap=$(( (st - sf) * 100 / st ))
msg="RAM ${uso}% em uso ($((disp/1024)) MB disponíveis), swap ${swap}%"
if [ "$uso" -ge "$c" ]; then f_status critico "$msg"; elif [ "$uso" -ge "$a" ]; then f_status alerta "$msg"; else f_status ok "$msg"; fi
exit 0
