#!/usr/bin/env bash
# ---
# id: macos-rede-info
# nome: "macOS - informações de rede"
# descricao: "Serviços de rede, IPs, DNS, Wi-Fi atual e rotas."
# categoria: macOS
# so: [macos]
# shell: bash
# tipo: auditoria
# tempo_limite: 120
# requer_admin: false
# tags: [rede]
# variaveis: []
# ---

networksetup -listallhardwareports | grep -E 'Hardware Port|Device'
for s in $(networksetup -listallnetworkservices | tail -n +2 | tr ' ' '_'); do n=$(echo "$s" | tr '_' ' '); echo "== $n"; networksetup -getinfo "$n" 2>/dev/null | grep -E 'IP address|Router|Subnet'; done
echo "DNS:"; scutil --dns | grep nameserver | sort -u
netstat -rn -f inet | head -8
exit 0
