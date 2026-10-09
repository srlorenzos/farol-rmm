#!/usr/bin/env bash
# ---
# id: macos-limpar-cache-dns
# nome: "macOS - limpar cache DNS"
# descricao: "Limpa o cache do DNS (dscacheutil e mDNSResponder)."
# categoria: macOS
# so: [macos]
# shell: bash
# tipo: acao
# tempo_limite: 60
# requer_admin: true
# tags: [dns, rede]
# variaveis: []
# ---

[ "$(id -u)" -eq 0 ] || { echo "Requer root."; exit 1; }
dscacheutil -flushcache; killall -HUP mDNSResponder && echo "Cache DNS limpo."
exit 0
