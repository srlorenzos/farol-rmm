#!/usr/bin/env bash
# ---
# id: linux-traceroute-mtr
# nome: "Linux - rastrear rota até destino"
# descricao: "Executa mtr (relatório) ou traceroute/tracepath até o destino."
# categoria: Rede
# so: [linux]
# shell: bash
# tipo: auditoria
# tempo_limite: 180
# requer_admin: false
# tags: [traceroute]
# variaveis:
#   - nome: HOST
#     rotulo: "Destino"
#     tipo: texto
#     padrao: "8.8.8.8"
#     obrigatorio: true
#     opcoes: []
# ---

h="$FAROL_HOST"; printf '%s' "$h" | grep -Eq '^[A-Za-z0-9._:-]+$' || { echo "Host inválido."; exit 1; }
if command -v mtr >/dev/null 2>&1; then mtr -rwc 10 "$h"; elif command -v traceroute >/dev/null 2>&1; then traceroute -w 2 "$h"; elif command -v tracepath >/dev/null 2>&1; then tracepath "$h"; else echo "Instale mtr, traceroute ou tracepath."; exit 1; fi
exit 0
