#!/usr/bin/env bash
# ---
# id: mon-linux-fail2ban-banidos
# nome: "Monitor - IPs banidos pelo fail2ban"
# descricao: "Conta IPs atualmente banidos em todas as jails do fail2ban."
# categoria: Monitoramento
# so: [linux]
# shell: bash
# tipo: monitor
# tempo_limite: 60
# requer_admin: true
# tags: [fail2ban, seguranca, monitor]
# variaveis:
#   - nome: ALERTA
#     rotulo: "Alerta a partir de"
#     tipo: numero
#     padrao: 20
#     obrigatorio: false
#     opcoes: []
#   - nome: CRITICO
#     rotulo: "Crítico a partir de"
#     tipo: numero
#     padrao: 100
#     obrigatorio: false
#     opcoes: []
# ---
f_num() { case "$1" in ''|*[!0-9]*) echo "$2";; *) echo "$1";; esac; }
f_status() { echo "FAROL_STATUS: $1 $2"; }

a=$(f_num "$FAROL_ALERTA" 20); c=$(f_num "$FAROL_CRITICO" 100)
command -v fail2ban-client >/dev/null 2>&1 || { f_status alerta "fail2ban não instalado"; exit 0; }
systemctl is-active --quiet fail2ban || { f_status critico "Serviço fail2ban parado"; exit 0; }
tot=0
for j in $(fail2ban-client status 2>/dev/null | awk -F: '/Jail list/ {gsub(/,/," ",$2); print $2}'); do n=$(fail2ban-client status "$j" 2>/dev/null | awk -F: '/Currently banned/ {gsub(/ /,"",$2); print $2}'); tot=$((tot + ${n:-0})); done
msg="$tot IP(s) banido(s) no momento"
if [ "$tot" -ge "$c" ]; then f_status critico "$msg"; elif [ "$tot" -ge "$a" ]; then f_status alerta "$msg"; else f_status ok "$msg"; fi
exit 0
