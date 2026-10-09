#!/usr/bin/env bash
# ---
# id: mon-linux-ping
# nome: "Monitor - disponibilidade e latência (ping)"
# descricao: "Faz ping a um host e avalia perda e latência média."
# categoria: Monitoramento
# so: [linux]
# shell: bash
# tipo: monitor
# tempo_limite: 60
# requer_admin: false
# tags: [rede, ping, monitor]
# variaveis:
#   - nome: HOST
#     rotulo: "Host"
#     tipo: texto
#     padrao: "8.8.8.8"
#     obrigatorio: true
#     opcoes: []
#   - nome: ALERTA_MS
#     rotulo: "Alerta (ms)"
#     tipo: numero
#     padrao: 100
#     obrigatorio: false
#     opcoes: []
#   - nome: CRITICO_MS
#     rotulo: "Crítico (ms)"
#     tipo: numero
#     padrao: 300
#     obrigatorio: false
#     opcoes: []
# ---
f_num() { case "$1" in ''|*[!0-9]*) echo "$2";; *) echo "$1";; esac; }
f_status() { echo "FAROL_STATUS: $1 $2"; }

h="$FAROL_HOST"; a=$(f_num "$FAROL_ALERTA_MS" 100); c=$(f_num "$FAROL_CRITICO_MS" 300)
printf '%s' "$h" | grep -Eq '^[A-Za-z0-9._:-]+$' || { echo "Host inválido."; exit 2; }
saida=$(ping -c 4 -W 2 "$h" 2>&1)
perda=$(printf '%s' "$saida" | grep -oE '[0-9]+(\.[0-9]+)?% packet loss' | grep -oE '^[0-9]+')
med=$(printf '%s' "$saida" | awk -F'/' '/rtt|round-trip/ {printf "%d", $5}')
[ -z "$perda" ] && { f_status critico "$h não responde"; exit 0; }
msg="$h: perda ${perda}%, média ${med:-?} ms"
if [ "$perda" -ge 50 ] || [ "${med:-0}" -ge "$c" ]; then f_status critico "$msg"; elif [ "$perda" -gt 0 ] || [ "${med:-0}" -ge "$a" ]; then f_status alerta "$msg"; else f_status ok "$msg"; fi
exit 0
