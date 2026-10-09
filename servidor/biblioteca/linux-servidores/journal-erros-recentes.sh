#!/usr/bin/env bash
# ---
# id: journal-erros-recentes
# nome: "journald - erros recentes"
# descricao: "Mostra mensagens de prioridade erro ou pior do journal nas últimas horas, agrupadas por unidade."
# categoria: Servidores Linux
# so: [linux]
# shell: bash
# tipo: auditoria
# tempo_limite: 120
# requer_admin: false
# tags: [journal, logs]
# variaveis:
#   - nome: HORAS
#     rotulo: "Janela (horas)"
#     tipo: numero
#     padrao: 24
#     obrigatorio: false
#     opcoes: []
# ---
f_num() { case "$1" in ''|*[!0-9]*) echo "$2";; *) echo "$1";; esac; }

h=$(f_num "$FAROL_HORAS" 24)
command -v journalctl >/dev/null 2>&1 || { echo "journalctl indisponível."; exit 1; }
echo "== Resumo por unidade =="
journalctl -p err --since "$h hours ago" --no-pager -o short-unix 2>/dev/null | awk '{print $4}' | sed 's/\[.*//;s/:$//' | sort | uniq -c | sort -rn | head -15
echo "== Últimas 15 mensagens =="
journalctl -p err --since "$h hours ago" --no-pager -n 15 2>/dev/null
exit 0
