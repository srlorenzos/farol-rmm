#!/usr/bin/env bash
# ---
# id: mon-linux-systemd-falhas
# nome: "Monitor - unidades systemd com falha"
# descricao: "Conta unidades em estado failed."
# categoria: Monitoramento
# so: [linux]
# shell: bash
# tipo: monitor
# tempo_limite: 60
# requer_admin: false
# tags: [systemd, monitor]
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
command -v systemctl >/dev/null 2>&1 || { f_status ok "systemd ausente"; exit 0; }
n=$(systemctl --failed --no-legend --plain 2>/dev/null | wc -l)
nomes=$(systemctl --failed --no-legend --plain 2>/dev/null | awk '{print $1}' | head -5 | tr '\n' ' ')
msg="$n unidade(s) com falha: $nomes"
if [ "$n" -ge "$c" ]; then f_status critico "$msg"; elif [ "$n" -ge "$a" ]; then f_status alerta "$msg"; else f_status ok "Nenhuma unidade com falha"; fi
exit 0
