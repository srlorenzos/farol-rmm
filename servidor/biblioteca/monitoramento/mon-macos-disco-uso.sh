#!/usr/bin/env bash
# ---
# id: mon-macos-disco-uso
# nome: "Monitor - uso de disco no macOS"
# descricao: "Alerta quando o volume de dados está com pouco espaço."
# categoria: Monitoramento
# so: [macos]
# shell: bash
# tipo: monitor
# tempo_limite: 60
# requer_admin: false
# tags: [disco, monitor]
# variaveis:
#   - nome: ALERTA
#     rotulo: "Alerta (% usado)"
#     tipo: numero
#     padrao: 85
#     obrigatorio: false
#     opcoes: []
#   - nome: CRITICO
#     rotulo: "Crítico (% usado)"
#     tipo: numero
#     padrao: 95
#     obrigatorio: false
#     opcoes: []
# ---
f_num() { case "$1" in ''|*[!0-9]*) echo "$2";; *) echo "$1";; esac; }
f_status() { echo "FAROL_STATUS: $1 $2"; }

a=$(f_num "$FAROL_ALERTA" 85); c=$(f_num "$FAROL_CRITICO" 95)
uso=$(df -P /System/Volumes/Data 2>/dev/null | awk 'NR==2 {gsub("%","",$5); print $5}'); [ -n "$uso" ] || uso=$(df -P / | awk 'NR==2 {gsub("%","",$5); print $5}')
msg="Disco ${uso}% usado"
if [ "$uso" -ge "$c" ]; then f_status critico "$msg"; elif [ "$uso" -ge "$a" ]; then f_status alerta "$msg"; else f_status ok "$msg"; fi
exit 0
