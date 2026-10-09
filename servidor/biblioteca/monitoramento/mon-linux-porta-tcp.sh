#!/usr/bin/env bash
# ---
# id: mon-linux-porta-tcp
# nome: "Monitor - porta TCP acessível"
# descricao: "Testa conexão TCP a host:porta com timeout."
# categoria: Monitoramento
# so: [linux]
# shell: bash
# tipo: monitor
# tempo_limite: 60
# requer_admin: false
# tags: [rede, tcp, monitor]
# variaveis:
#   - nome: HOST
#     rotulo: "Host"
#     tipo: texto
#     padrao: "127.0.0.1"
#     obrigatorio: true
#     opcoes: []
#   - nome: PORTA
#     rotulo: "Porta"
#     tipo: numero
#     padrao: 22
#     obrigatorio: true
#     opcoes: []
# ---
f_num() { case "$1" in ''|*[!0-9]*) echo "$2";; *) echo "$1";; esac; }
f_status() { echo "FAROL_STATUS: $1 $2"; }

h="$FAROL_HOST"; p=$(f_num "$FAROL_PORTA" 0)
printf '%s' "$h" | grep -Eq '^[A-Za-z0-9._:-]+$' || { echo "Host inválido."; exit 2; }
[ "$p" -ge 1 ] && [ "$p" -le 65535 ] || { echo "Porta inválida."; exit 2; }
if timeout 4 bash -c "exec 3<>/dev/tcp/$h/$p" 2>/dev/null; then f_status ok "$h:$p acessível"; else f_status critico "$h:$p inacessível"; fi
exit 0
