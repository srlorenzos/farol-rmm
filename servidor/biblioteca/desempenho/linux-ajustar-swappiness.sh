#!/usr/bin/env bash
# ---
# id: linux-ajustar-swappiness
# nome: "Linux - ajustar swappiness e cache pressure"
# descricao: "Define vm.swappiness e vm.vfs_cache_pressure de forma persistente (sysctl.d)."
# categoria: Desempenho
# so: [linux]
# shell: bash
# tipo: acao
# tempo_limite: 60
# requer_admin: true
# tags: [sysctl, memoria]
# variaveis:
#   - nome: SWAPPINESS
#     rotulo: "Swappiness (0-100)"
#     tipo: numero
#     padrao: 10
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
f_root() { [ "$(id -u)" -eq 0 ] || { echo "ERRO: execute como root."; exit 1; }; }
f_confirmar() { f_sim "$FAROL_CONFIRMAR"; }

f_root
s=$(f_num "$FAROL_SWAPPINESS" 10); [ "$s" -le 100 ] || { echo "Valor inválido."; exit 1; }
echo "Atual: swappiness=$(sysctl -n vm.swappiness) vfs_cache_pressure=$(sysctl -n vm.vfs_cache_pressure)"
if ! f_confirmar; then echo "Defina CONFIRMAR=true para aplicar swappiness=$s."; exit 0; fi
printf 'vm.swappiness = %s\nvm.vfs_cache_pressure = 50\n' "$s" > /etc/sysctl.d/99-farol-memoria.conf
sysctl --system >/dev/null && echo "Aplicado."
exit 0
