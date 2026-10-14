#!/usr/bin/env bash
# ---
# id: macos-ativar-firewall
# nome: "macOS - ativar firewall de aplicativo"
# descricao: "Habilita o firewall de aplicativos do macOS e o modo furtivo opcional."
# categoria: macOS
# so: [macos]
# shell: bash
# tipo: acao
# tempo_limite: 60
# requer_admin: true
# tags: [firewall, hardening]
# variaveis:
#   - nome: FURTIVO
#     rotulo: "Modo furtivo"
#     tipo: booleano
#     padrao: false
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
f_confirmar() { f_sim "$FAROL_CONFIRMAR"; }

fw=/usr/libexec/ApplicationFirewall/socketfilterfw
$fw --getglobalstate
if ! f_confirmar; then echo "Defina CONFIRMAR=true para ativar."; exit 0; fi
[ "$(id -u)" -eq 0 ] || { echo "Requer root."; exit 1; }
$fw --setglobalstate on
f_sim "$FAROL_FURTIVO" && $fw --setstealthmode on
$fw --getglobalstate
exit 0
