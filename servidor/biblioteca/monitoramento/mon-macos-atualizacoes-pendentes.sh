#!/usr/bin/env bash
# ---
# id: mon-macos-atualizacoes-pendentes
# nome: "Monitor - atualizações do macOS pendentes"
# descricao: "Conta atualizações de sistema disponíveis pelo softwareupdate."
# categoria: Monitoramento
# so: [macos]
# shell: bash
# tipo: monitor
# tempo_limite: 180
# requer_admin: false
# tags: [atualizacoes, monitor]
# variaveis:
#   - nome: ALERTA
#     rotulo: "Alerta a partir de"
#     tipo: numero
#     padrao: 1
#     obrigatorio: false
#     opcoes: []
#   - nome: CRITICO
#     rotulo: "Crítico a partir de"
#     tipo: numero
#     padrao: 5
#     obrigatorio: false
#     opcoes: []
# ---
f_num() { case "$1" in ''|*[!0-9]*) echo "$2";; *) echo "$1";; esac; }
f_status() { echo "FAROL_STATUS: $1 $2"; }

a=$(f_num "$FAROL_ALERTA" 1); c=$(f_num "$FAROL_CRITICO" 5)
n=$(softwareupdate -l 2>&1 | grep -c '^\* Label')
msg="$n atualização(ões) pendente(s)"
if [ "$n" -ge "$c" ]; then f_status critico "$msg"; elif [ "$n" -ge "$a" ]; then f_status alerta "$msg"; else f_status ok "Sistema atualizado"; fi
exit 0
