#!/usr/bin/env bash
# ---
# id: mon-linux-backup-arquivo-recente
# nome: "Monitor - backup recente"
# descricao: "Verifica se há arquivo modificado nas últimas N horas em um diretório de backup."
# categoria: Monitoramento
# so: [linux]
# shell: bash
# tipo: monitor
# tempo_limite: 60
# requer_admin: false
# tags: [backup, monitor]
# variaveis:
#   - nome: CAMINHO
#     rotulo: "Diretório ou arquivo de backup"
#     tipo: texto
#     padrao: ""
#     obrigatorio: true
#     opcoes: []
#   - nome: ALERTA_HORAS
#     rotulo: "Alerta (horas)"
#     tipo: numero
#     padrao: 26
#     obrigatorio: false
#     opcoes: []
#   - nome: CRITICO_HORAS
#     rotulo: "Crítico (horas)"
#     tipo: numero
#     padrao: 50
#     obrigatorio: false
#     opcoes: []
# ---
f_num() { case "$1" in ''|*[!0-9]*) echo "$2";; *) echo "$1";; esac; }
f_status() { echo "FAROL_STATUS: $1 $2"; }

p="$FAROL_CAMINHO"; a=$(f_num "$FAROL_ALERTA_HORAS" 26); c=$(f_num "$FAROL_CRITICO_HORAS" 50)
[ -e "$p" ] || { f_status critico "Caminho inexistente: $p"; exit 0; }
ult=$(find "$p" -type f -printf '%T@ %p\n' 2>/dev/null | sort -n | tail -1)
[ -n "$ult" ] || { f_status critico "Nenhum arquivo em $p"; exit 0; }
ts=${ult%% *}; nome=${ult#* }
h=$(( ( $(date +%s) - ${ts%.*} ) / 3600 ))
msg="Último arquivo ($(basename "$nome")) há ${h} h"
if [ "$h" -ge "$c" ]; then f_status critico "$msg"; elif [ "$h" -ge "$a" ]; then f_status alerta "$msg"; else f_status ok "$msg"; fi
exit 0
