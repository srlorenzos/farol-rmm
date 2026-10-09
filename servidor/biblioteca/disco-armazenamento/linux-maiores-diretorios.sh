#!/usr/bin/env bash
# ---
# id: linux-maiores-diretorios
# nome: "Linux - maiores diretórios"
# descricao: "Calcula o tamanho dos subdiretórios de um caminho (sem cruzar filesystems) e lista os maiores."
# categoria: Disco e armazenamento
# so: [linux]
# shell: bash
# tipo: auditoria
# tempo_limite: 600
# requer_admin: false
# tags: [disco, du]
# variaveis:
#   - nome: CAMINHO
#     rotulo: "Caminho"
#     tipo: texto
#     padrao: "/"
#     obrigatorio: false
#     opcoes: []
#   - nome: TOP
#     rotulo: "Quantidade"
#     tipo: numero
#     padrao: 15
#     obrigatorio: false
#     opcoes: []
# ---
f_num() { case "$1" in ''|*[!0-9]*) echo "$2";; *) echo "$1";; esac; }

c="${FAROL_CAMINHO:-/}"; [ -d "$c" ] || { echo "Caminho inválido."; exit 1; }
du -xh --max-depth=1 "$c" 2>/dev/null | sort -rh | head -n "$(f_num "$FAROL_TOP" 15)"
exit 0
