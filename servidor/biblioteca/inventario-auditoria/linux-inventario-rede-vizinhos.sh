#!/usr/bin/env bash
# ---
# id: linux-inventario-rede-vizinhos
# nome: "Linux - vizinhos da rede local (ARP)"
# descricao: "Lista hosts vistos na rede (ip neigh) e, se nmap existir, faz varredura ping da sub-rede local."
# categoria: Inventário e auditoria
# so: [linux]
# shell: bash
# tipo: auditoria
# tempo_limite: 300
# requer_admin: false
# tags: [rede, descoberta]
# variaveis:
#   - nome: VARRER
#     rotulo: "Varrer a sub-rede com nmap -sn"
#     tipo: booleano
#     padrao: false
#     obrigatorio: false
#     opcoes: []
# ---
f_sim() { case "$(printf '%s' "$1" | tr 'A-Z' 'a-z')" in 1|true|sim|s|yes|y|verdadeiro) return 0;; *) return 1;; esac; }

ip neigh | grep -v FAILED | awk '{print $1, $5, $6}'
if f_sim "$FAROL_VARRER"; then command -v nmap >/dev/null 2>&1 || { echo "nmap não instalado."; exit 1; }; sub=$(ip -4 -o addr | awk '!/ lo / {print $4; exit}'); nmap -sn "$sub" | grep -E 'report|MAC'; fi
exit 0
