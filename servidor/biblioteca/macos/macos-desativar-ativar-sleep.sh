#!/usr/bin/env bash
# ---
# id: macos-desativar-ativar-sleep
# nome: "macOS - configurar suspensão e energia"
# descricao: "Mostra e opcionalmente define minutos de suspensão do sistema e do display (pmset)."
# categoria: macOS
# so: [macos]
# shell: bash
# tipo: acao
# tempo_limite: 60
# requer_admin: true
# tags: [energia, pmset]
# variaveis:
#   - nome: SUSPENDER_MIN
#     rotulo: "Minutos para suspender (0 = nunca)"
#     tipo: numero
#     padrao: ""
#     obrigatorio: false
#     opcoes: []
#   - nome: TELA_MIN
#     rotulo: "Minutos para desligar a tela"
#     tipo: numero
#     padrao: ""
#     obrigatorio: false
#     opcoes: []
#   - nome: CONFIRMAR
#     rotulo: "Digite true para confirmar a execução"
#     tipo: booleano
#     padrao: false
#     obrigatorio: false
#     opcoes: []
# ---
f_sim() { case "$(printf '%s' "$1" | tr 'A-Z' 'a-z')" in 1|true|sim|s|yes|y|verdadeiro) return 0;; *) return 1;; esac; }
f_num() { case "$1" in ''|*[!0-9]*) echo "$2";; *) echo "$1";; esac; }
f_confirmar() { f_sim "$FAROL_CONFIRMAR"; }

pmset -g | head -20
if ! f_confirmar; then echo "Defina CONFIRMAR=true para aplicar."; exit 0; fi
[ "$(id -u)" -eq 0 ] || { echo "Requer root."; exit 1; }
[ -n "$FAROL_SUSPENDER_MIN" ] && pmset -a sleep "$(f_num "$FAROL_SUSPENDER_MIN" 0)"
[ -n "$FAROL_TELA_MIN" ] && pmset -a displaysleep "$(f_num "$FAROL_TELA_MIN" 10)"
exit 0
