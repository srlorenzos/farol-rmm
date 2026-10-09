#!/usr/bin/env bash
# ---
# id: mon-linux-uptime
# nome: "Monitor - tempo ligado sem reiniciar"
# descricao: "Alerta quando o servidor está há muitos dias sem reiniciar (kernel desatualizado)."
# categoria: Monitoramento
# so: [linux]
# shell: bash
# tipo: monitor
# tempo_limite: 60
# requer_admin: false
# tags: [uptime, monitor]
# variaveis:
#   - nome: ALERTA
#     rotulo: "Alerta (dias)"
#     tipo: numero
#     padrao: 90
#     obrigatorio: false
#     opcoes: []
#   - nome: CRITICO
#     rotulo: "Crítico (dias)"
#     tipo: numero
#     padrao: 180
#     obrigatorio: false
#     opcoes: []
# ---
f_num() { case "$1" in ''|*[!0-9]*) echo "$2";; *) echo "$1";; esac; }
f_status() { echo "FAROL_STATUS: $1 $2"; }

a=$(f_num "$FAROL_ALERTA" 90); c=$(f_num "$FAROL_CRITICO" 180)
d=$(awk '{printf "%d", $1/86400}' /proc/uptime)
msg="Ligado há $d dia(s)"
if [ "$d" -ge "$c" ]; then f_status critico "$msg"; elif [ "$d" -ge "$a" ]; then f_status alerta "$msg"; else f_status ok "$msg"; fi
exit 0
