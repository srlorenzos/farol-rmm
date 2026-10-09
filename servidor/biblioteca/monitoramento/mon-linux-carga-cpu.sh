#!/usr/bin/env bash
# ---
# id: mon-linux-carga-cpu
# nome: "Monitor - carga média do sistema"
# descricao: "Compara o load average de 5 minutos com o número de CPUs."
# categoria: Monitoramento
# so: [linux]
# shell: bash
# tipo: monitor
# tempo_limite: 60
# requer_admin: false
# tags: [cpu, load, monitor]
# variaveis:
#   - nome: ALERTA
#     rotulo: "Alerta (carga por CPU x100, ex. 100 = 1.0)"
#     tipo: numero
#     padrao: 100
#     obrigatorio: false
#     opcoes: []
#   - nome: CRITICO
#     rotulo: "Crítico (carga por CPU x100)"
#     tipo: numero
#     padrao: 200
#     obrigatorio: false
#     opcoes: []
# ---
f_num() { case "$1" in ''|*[!0-9]*) echo "$2";; *) echo "$1";; esac; }
f_status() { echo "FAROL_STATUS: $1 $2"; }

a=$(f_num "$FAROL_ALERTA" 100); c=$(f_num "$FAROL_CRITICO" 200)
n=$(nproc 2>/dev/null || grep -c ^processor /proc/cpuinfo)
l5=$(awk '{print $2}' /proc/loadavg)
rel=$(awk -v l="$l5" -v n="$n" 'BEGIN {printf "%d", l / n * 100}')
msg="Load 5min $l5 em $n CPU(s) (${rel}% da capacidade)"
if [ "$rel" -ge "$c" ]; then f_status critico "$msg"; elif [ "$rel" -ge "$a" ]; then f_status alerta "$msg"; else f_status ok "$msg"; fi
exit 0
