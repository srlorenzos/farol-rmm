#!/usr/bin/env bash
# ---
# id: mon-linux-conexoes-estabelecidas
# nome: "Monitor - quantidade de conexões TCP"
# descricao: "Conta conexões TCP estabelecidas e em TIME_WAIT, para detectar picos ou ataques."
# categoria: Monitoramento
# so: [linux]
# shell: bash
# tipo: monitor
# tempo_limite: 60
# requer_admin: false
# tags: [rede, conexoes, monitor]
# variaveis:
#   - nome: ALERTA
#     rotulo: "Alerta (estabelecidas)"
#     tipo: numero
#     padrao: 1000
#     obrigatorio: false
#     opcoes: []
#   - nome: CRITICO
#     rotulo: "Crítico (estabelecidas)"
#     tipo: numero
#     padrao: 5000
#     obrigatorio: false
#     opcoes: []
# ---
f_num() { case "$1" in ''|*[!0-9]*) echo "$2";; *) echo "$1";; esac; }
f_status() { echo "FAROL_STATUS: $1 $2"; }

a=$(f_num "$FAROL_ALERTA" 1000); c=$(f_num "$FAROL_CRITICO" 5000)
if command -v ss >/dev/null 2>&1; then est=$(ss -tn state established 2>/dev/null | tail -n +2 | wc -l); tw=$(ss -tn state time-wait 2>/dev/null | tail -n +2 | wc -l)
else est=$(netstat -tn 2>/dev/null | grep -c ESTABLISHED); tw=$(netstat -tn 2>/dev/null | grep -c TIME_WAIT); fi
msg="$est estabelecida(s), $tw em TIME_WAIT"
if [ "$est" -ge "$c" ]; then f_status critico "$msg"; elif [ "$est" -ge "$a" ]; then f_status alerta "$msg"; else f_status ok "$msg"; fi
exit 0
