#!/usr/bin/env bash
# ---
# id: linux-arquivos-deletados-em-uso
# nome: "Linux - arquivos apagados ainda abertos"
# descricao: "Lista arquivos deletados mas mantidos abertos por processos (espaço não liberado). Informa o processo para reinício."
# categoria: Disco e armazenamento
# so: [linux]
# shell: bash
# tipo: auditoria
# tempo_limite: 120
# requer_admin: true
# tags: [disco, lsof]
# variaveis: []
# ---

command -v lsof >/dev/null 2>&1 || { echo "lsof não instalado."; exit 1; }
lsof -nP +L1 2>/dev/null | awk 'NR==1 || $7 > 10485760 {print}' | head -30
exit 0
