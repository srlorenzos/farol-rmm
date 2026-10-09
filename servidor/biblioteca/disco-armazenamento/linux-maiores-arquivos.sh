#!/usr/bin/env bash
# ---
# id: linux-maiores-arquivos
# nome: "Linux - maiores arquivos"
# descricao: "Localiza os maiores arquivos acima de um tamanho mínimo."
# categoria: Disco e armazenamento
# so: [linux]
# shell: bash
# tipo: auditoria
# tempo_limite: 600
# requer_admin: false
# tags: [disco, arquivos]
# variaveis:
#   - nome: CAMINHO
#     rotulo: "Caminho"
#     tipo: texto
#     padrao: "/"
#     obrigatorio: false
#     opcoes: []
#   - nome: MIN_MB
#     rotulo: "Tamanho mínimo (MB)"
#     tipo: numero
#     padrao: 500
#     obrigatorio: false
#     opcoes: []
#   - nome: TOP
#     rotulo: "Quantidade"
#     tipo: numero
#     padrao: 20
#     obrigatorio: false
#     opcoes: []
# ---
f_num() { case "$1" in ''|*[!0-9]*) echo "$2";; *) echo "$1";; esac; }

c="${FAROL_CAMINHO:-/}"; [ -d "$c" ] || { echo "Caminho inválido."; exit 1; }
find "$c" -xdev -type f -size +"$(f_num "$FAROL_MIN_MB" 500)"M -printf '%s %TY-%Tm-%Td %p\n' 2>/dev/null | sort -rn | head -n "$(f_num "$FAROL_TOP" 20)" | awk '{s=$1; $1=""; printf "%8.1f MB %s\n", s/1048576, $0}'
exit 0
