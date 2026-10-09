#!/usr/bin/env bash
# ---
# id: linux-top-processos
# nome: "Linux - processos com maior consumo"
# descricao: "Lista os processos com maior CPU e memória, com usuário e comando."
# categoria: Serviços e processos
# so: [linux]
# shell: bash
# tipo: auditoria
# tempo_limite: 120
# requer_admin: false
# tags: [processos]
# variaveis:
#   - nome: TOP
#     rotulo: "Quantidade"
#     tipo: numero
#     padrao: 10
#     obrigatorio: false
#     opcoes: []
# ---
f_num() { case "$1" in ''|*[!0-9]*) echo "$2";; *) echo "$1";; esac; }

n=$(f_num "$FAROL_TOP" 10)
echo "== Top CPU =="; ps -eo pid,user,%cpu,%mem,etime,comm --sort=-%cpu | head -n $((n+1))
echo "== Top memória =="; ps -eo pid,user,%cpu,%mem,rss,comm --sort=-rss | head -n $((n+1))
exit 0
