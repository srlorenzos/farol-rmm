#!/usr/bin/env bash
# ---
# id: linux-sincronizar-hora-timezone
# nome: "Linux - ajustar fuso horário e sincronizar relógio"
# descricao: "Mostra e opcionalmente define o fuso horário (timedatectl) e ativa a sincronização NTP."
# categoria: Utilitários
# so: [linux]
# shell: bash
# tipo: acao
# tempo_limite: 60
# requer_admin: true
# tags: [hora, fuso]
# variaveis:
#   - nome: FUSO
#     rotulo: "Fuso (ex.: America/Sao_Paulo)"
#     tipo: texto
#     padrao: "America/Sao_Paulo"
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
f_root() { [ "$(id -u)" -eq 0 ] || { echo "ERRO: execute como root."; exit 1; }; }
f_confirmar() { f_sim "$FAROL_CONFIRMAR"; }

f_root
timedatectl 2>/dev/null | head -8
if ! f_confirmar; then echo "Defina CONFIRMAR=true para aplicar."; exit 0; fi
f="${FAROL_FUSO:-America/Sao_Paulo}"
[ -f "/usr/share/zoneinfo/$f" ] || { echo "Fuso inválido."; exit 1; }
timedatectl set-timezone "$f" && timedatectl set-ntp true
timedatectl | head -6
exit 0
