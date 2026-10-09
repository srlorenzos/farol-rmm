#!/usr/bin/env bash
# ---
# id: linux-info-rede
# nome: "Linux - informações de rede"
# descricao: "Interfaces, IPs, rotas, DNS, MACs, velocidade do link e portas em escuta."
# categoria: Rede
# so: [linux]
# shell: bash
# tipo: auditoria
# tempo_limite: 120
# requer_admin: false
# tags: [rede, ip]
# variaveis: []
# ---

ip -br addr; echo; ip route; echo
echo "DNS:"; grep -E '^(nameserver|search)' /etc/resolv.conf; command -v resolvectl >/dev/null 2>&1 && resolvectl status 2>/dev/null | grep -E 'DNS Servers|Link' | head -6
echo; for i in $(ls /sys/class/net | grep -v '^lo$'); do echo "$i: MAC $(cat /sys/class/net/$i/address) velocidade $(cat /sys/class/net/$i/speed 2>/dev/null || echo n/d) Mb/s estado $(cat /sys/class/net/$i/operstate)"; done
exit 0
