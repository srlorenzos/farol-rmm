#!/usr/bin/env bash
# ---
# id: linux-wol-habilitar-ethtool
# nome: "Linux - verificar e habilitar Wake-on-LAN"
# descricao: "Mostra o estado do Wake-on-LAN de uma interface (ethtool) e, com confirmação, habilita o modo magic packet (g)."
# categoria: Rede
# so: [linux]
# shell: bash
# tipo: acao
# tempo_limite: 60
# requer_admin: true
# tags: [wol, ethtool]
# variaveis:
#   - nome: INTERFACE
#     rotulo: "Interface"
#     tipo: texto
#     padrao: ""
#     obrigatorio: true
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
f_nome_ok() { printf '%s' "$1" | grep -Eq '^[A-Za-z0-9][A-Za-z0-9._+:@-]*$'; }
f_confirmar() { f_sim "$FAROL_CONFIRMAR"; }

f_root
i="$FAROL_INTERFACE"; f_nome_ok "$i" || { echo "Interface inválida."; exit 1; }
command -v ethtool >/dev/null 2>&1 || { echo "ethtool não instalado."; exit 1; }
ethtool "$i" | grep -E 'Wake-on|Supports Wake-on'
if ! f_confirmar; then echo "Defina CONFIRMAR=true para habilitar WoL (não persiste após reboot sem regra do NetworkManager/udev)."; exit 0; fi
ethtool -s "$i" wol g && echo "WoL habilitado em $i."
exit 0
