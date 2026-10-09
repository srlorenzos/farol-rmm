#!/usr/bin/env bash
# ---
# id: mon-linux-disco-uso
# nome: "Monitor - uso de disco de um ponto de montagem"
# descricao: "Alerta quando o percentual usado de um filesystem passa dos limites."
# categoria: Monitoramento
# so: [linux]
# shell: bash
# tipo: monitor
# tempo_limite: 60
# requer_admin: false
# tags: [disco, capacidade, monitor]
# variaveis:
#   - nome: PONTO
#     rotulo: "Ponto de montagem"
#     tipo: texto
#     padrao: "/"
#     obrigatorio: false
#     opcoes: []
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

p="${FAROL_PONTO:-/}"; a=$(f_num "$FAROL_ALERTA" 85); c=$(f_num "$FAROL_CRITICO" 95)
[ -d "$p" ] || { echo "Ponto inexistente: $p"; exit 2; }
uso=$(df -P "$p" | awk 'NR==2 {gsub("%","",$5); print $5}')
livre=$(df -Ph "$p" | awk 'NR==2 {print $4}')
msg="$p: ${uso}% usado, $livre livres"
if [ "$uso" -ge "$c" ]; then f_status critico "$msg"; elif [ "$uso" -ge "$a" ]; then f_status alerta "$msg"; else f_status ok "$msg"; fi
exit 0
