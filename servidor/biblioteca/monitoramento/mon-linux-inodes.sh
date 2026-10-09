#!/usr/bin/env bash
# ---
# id: mon-linux-inodes
# nome: "Monitor - uso de inodes"
# descricao: "Alerta quando os inodes de um filesystem estão quase esgotados (disco \"cheio\" com espaço livre)."
# categoria: Monitoramento
# so: [linux]
# shell: bash
# tipo: monitor
# tempo_limite: 60
# requer_admin: false
# tags: [disco, inodes, monitor]
# variaveis:
#   - nome: PONTO
#     rotulo: "Ponto de montagem"
#     tipo: texto
#     padrao: "/"
#     obrigatorio: false
#     opcoes: []
#   - nome: ALERTA
#     rotulo: "Alerta (%)"
#     tipo: numero
#     padrao: 85
#     obrigatorio: false
#     opcoes: []
#   - nome: CRITICO
#     rotulo: "Crítico (%)"
#     tipo: numero
#     padrao: 95
#     obrigatorio: false
#     opcoes: []
# ---
f_num() { case "$1" in ''|*[!0-9]*) echo "$2";; *) echo "$1";; esac; }
f_status() { echo "FAROL_STATUS: $1 $2"; }

p="${FAROL_PONTO:-/}"; a=$(f_num "$FAROL_ALERTA" 85); c=$(f_num "$FAROL_CRITICO" 95)
uso=$(df -Pi "$p" 2>/dev/null | awk 'NR==2 {gsub("%","",$5); print $5}')
case "$uso" in ''|-) f_status ok "$p: sem contagem de inodes (fs dinâmico)"; exit 0;; esac
msg="$p: ${uso}% dos inodes em uso"
if [ "$uso" -ge "$c" ]; then f_status critico "$msg"; elif [ "$uso" -ge "$a" ]; then f_status alerta "$msg"; else f_status ok "$msg"; fi
exit 0
