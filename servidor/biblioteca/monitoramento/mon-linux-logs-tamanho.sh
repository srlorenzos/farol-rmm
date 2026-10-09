#!/usr/bin/env bash
# ---
# id: mon-linux-logs-tamanho
# nome: "Monitor - tamanho de /var/log e do journal"
# descricao: "Alerta quando /var/log (ou o journal) ocupa espaço excessivo."
# categoria: Monitoramento
# so: [linux]
# shell: bash
# tipo: monitor
# tempo_limite: 60
# requer_admin: false
# tags: [logs, disco, monitor]
# variaveis:
#   - nome: ALERTA_MB
#     rotulo: "Alerta (MB)"
#     tipo: numero
#     padrao: 2048
#     obrigatorio: false
#     opcoes: []
#   - nome: CRITICO_MB
#     rotulo: "Crítico (MB)"
#     tipo: numero
#     padrao: 8192
#     obrigatorio: false
#     opcoes: []
# ---
f_num() { case "$1" in ''|*[!0-9]*) echo "$2";; *) echo "$1";; esac; }
f_status() { echo "FAROL_STATUS: $1 $2"; }

a=$(f_num "$FAROL_ALERTA_MB" 2048); c=$(f_num "$FAROL_CRITICO_MB" 8192)
mb=$(du -sm /var/log 2>/dev/null | awk '{print $1}'); mb=${mb:-0}
msg="/var/log ocupa ${mb} MB"
if [ "$mb" -ge "$c" ]; then f_status critico "$msg"; elif [ "$mb" -ge "$a" ]; then f_status alerta "$msg"; else f_status ok "$msg"; fi
exit 0
