#!/usr/bin/env bash
# ---
# id: mon-linux-disco-todos
# nome: "Monitor - todos os filesystems"
# descricao: "Verifica todos os filesystems reais e reporta o pior percentual de uso."
# categoria: Monitoramento
# so: [linux]
# shell: bash
# tipo: monitor
# tempo_limite: 60
# requer_admin: false
# tags: [disco, monitor]
# variaveis:
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

a=$(f_num "$FAROL_ALERTA" 85); c=$(f_num "$FAROL_CRITICO" 95)
linhas=$(df -P -x tmpfs -x devtmpfs -x squashfs -x overlay -x efivarfs 2>/dev/null | awk 'NR>1 {gsub("%","",$5); print $5, $6}')
pior=0; det=""
while read -r uso mp; do [ -z "$uso" ] && continue; det="$det $mp=${uso}%"; [ "$uso" -gt "$pior" ] && pior=$uso; done <<EOF
$linhas
EOF
msg="Volumes:$det"
if [ "$pior" -ge "$c" ]; then f_status critico "$msg"; elif [ "$pior" -ge "$a" ]; then f_status alerta "$msg"; else f_status ok "$msg"; fi
exit 0
