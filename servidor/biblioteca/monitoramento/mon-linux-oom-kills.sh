#!/usr/bin/env bash
# ---
# id: mon-linux-oom-kills
# nome: "Monitor - eventos de falta de memória (OOM killer)"
# descricao: "Detecta processos encerrados pelo OOM killer nas últimas horas."
# categoria: Monitoramento
# so: [linux]
# shell: bash
# tipo: monitor
# tempo_limite: 60
# requer_admin: false
# tags: [memoria, oom, monitor]
# variaveis:
#   - nome: HORAS
#     rotulo: "Janela (horas)"
#     tipo: numero
#     padrao: 24
#     obrigatorio: false
#     opcoes: []
# ---
f_num() { case "$1" in ''|*[!0-9]*) echo "$2";; *) echo "$1";; esac; }
f_status() { echo "FAROL_STATUS: $1 $2"; }

h=$(f_num "$FAROL_HORAS" 24)
if command -v journalctl >/dev/null 2>&1; then n=$(journalctl -k --since "$h hours ago" --no-pager 2>/dev/null | grep -ci 'out of memory\|oom-kill\|killed process')
else n=$(dmesg 2>/dev/null | grep -ci 'out of memory\|killed process'); fi
if [ "$n" -gt 0 ]; then f_status critico "$n evento(s) de OOM nas últimas ${h}h"; else f_status ok "Sem OOM nas últimas ${h}h"; fi
exit 0
