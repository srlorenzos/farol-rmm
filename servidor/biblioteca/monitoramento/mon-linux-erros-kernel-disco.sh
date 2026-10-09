#!/usr/bin/env bash
# ---
# id: mon-linux-erros-kernel-disco
# nome: "Monitor - erros de I/O e filesystem no kernel"
# descricao: "Procura no log do kernel erros de I/O, filesystem remontado como somente leitura e falhas de disco."
# categoria: Monitoramento
# so: [linux]
# shell: bash
# tipo: monitor
# tempo_limite: 60
# requer_admin: false
# tags: [kernel, disco, monitor]
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
if command -v journalctl >/dev/null 2>&1; then fonte=$(journalctl -k --since "$h hours ago" --no-pager 2>/dev/null); else fonte=$(dmesg 2>/dev/null); fi
n=$(printf '%s' "$fonte" | grep -Eci 'I/O error|EXT4-fs error|XFS.*(error|corrupt)|Remounting filesystem read-only|ata[0-9.]+: (failed|error)|blk_update_request')
if [ "$n" -ge 3 ]; then f_status critico "$n erro(s) de I/O/filesystem em ${h}h"; elif [ "$n" -gt 0 ]; then f_status alerta "$n erro(s) de I/O/filesystem em ${h}h"; else f_status ok "Sem erros de disco no kernel"; fi
exit 0
