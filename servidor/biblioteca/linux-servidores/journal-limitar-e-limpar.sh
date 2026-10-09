#!/usr/bin/env bash
# ---
# id: journal-limitar-e-limpar
# nome: "journald - limitar tamanho e limpar logs antigos"
# descricao: "Mostra o uso do journal e, com confirmação, faz vacuum por tamanho e/ou idade."
# categoria: Servidores Linux
# so: [linux]
# shell: bash
# tipo: acao
# tempo_limite: 120
# requer_admin: true
# tags: [journal, limpeza]
# variaveis:
#   - nome: MAX_MB
#     rotulo: "Manter no máximo (MB)"
#     tipo: numero
#     padrao: 500
#     obrigatorio: false
#     opcoes: []
#   - nome: DIAS
#     rotulo: "Manter no máximo (dias)"
#     tipo: numero
#     padrao: 30
#     obrigatorio: false
#     opcoes: []
#   - nome: SIMULAR
#     rotulo: "Modo simulação (não altera nada; use false para aplicar)"
#     tipo: booleano
#     padrao: true
#     obrigatorio: false
#     opcoes: []
# ---
f_num() { case "$1" in ''|*[!0-9]*) echo "$2";; *) echo "$1";; esac; }
f_root() { [ "$(id -u)" -eq 0 ] || { echo "ERRO: execute como root."; exit 1; }; }
f_simular() { case "$(printf '%s' "$FAROL_SIMULAR" | tr 'A-Z' 'a-z')" in 0|false|nao|não|n|no|falso) return 1;; *) return 0;; esac; }

f_root
journalctl --disk-usage
if f_simular; then echo "SIMULAÇÃO: usaria --vacuum-size=$(f_num "$FAROL_MAX_MB" 500)M --vacuum-time=$(f_num "$FAROL_DIAS" 30)d (SIMULAR=false para aplicar)."; exit 0; fi
journalctl --vacuum-size="$(f_num "$FAROL_MAX_MB" 500)M" --vacuum-time="$(f_num "$FAROL_DIAS" 30)d"
journalctl --disk-usage
exit 0
