#!/usr/bin/env bash
# ---
# id: mon-linux-zumbis
# nome: "Monitor - processos zumbis"
# descricao: "Conta processos zumbis (defunct), indício de aplicações com falha no tratamento de filhos."
# categoria: Monitoramento
# so: [linux]
# shell: bash
# tipo: monitor
# tempo_limite: 60
# requer_admin: false
# tags: [processos, monitor]
# variaveis:
#   - nome: ALERTA
#     rotulo: "Alerta a partir de"
#     tipo: numero
#     padrao: 5
#     obrigatorio: false
#     opcoes: []
#   - nome: CRITICO
#     rotulo: "Crítico a partir de"
#     tipo: numero
#     padrao: 50
#     obrigatorio: false
#     opcoes: []
# ---
f_num() { case "$1" in ''|*[!0-9]*) echo "$2";; *) echo "$1";; esac; }
f_status() { echo "FAROL_STATUS: $1 $2"; }

a=$(f_num "$FAROL_ALERTA" 5); c=$(f_num "$FAROL_CRITICO" 50)
n=$(ps -eo stat= | grep -c '^Z')
msg="$n processo(s) zumbi"
if [ "$n" -ge "$c" ]; then f_status critico "$msg"; elif [ "$n" -ge "$a" ]; then f_status alerta "$msg"; else f_status ok "$msg"; fi
exit 0
