#!/usr/bin/env bash
# ---
# id: macos-sincronizar-hora
# nome: "macOS - sincronizar hora"
# descricao: "Ativa a sincronização automática de hora e ajusta o servidor NTP."
# categoria: macOS
# so: [macos]
# shell: bash
# tipo: acao
# tempo_limite: 60
# requer_admin: true
# tags: [ntp, hora]
# variaveis:
#   - nome: SERVIDOR
#     rotulo: "Servidor NTP"
#     tipo: texto
#     padrao: "time.apple.com"
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

[ "$(id -u)" -eq 0 ] || { echo "Requer root."; exit 1; }
systemsetup -getnetworktimeserver 2>&1; systemsetup -getusingnetworktime 2>&1
if ! f_confirmar; then echo "Defina CONFIRMAR=true para aplicar."; exit 0; fi
s="${FAROL_SERVIDOR:-time.apple.com}"; printf '%s' "$s" | grep -Eq '^[A-Za-z0-9.-]+$' || { echo "Servidor inválido."; exit 1; }
systemsetup -setnetworktimeserver "$s" >/dev/null; systemsetup -setusingnetworktime on >/dev/null; sntp -sS "$s" 2>&1 | tail -1
exit 0
