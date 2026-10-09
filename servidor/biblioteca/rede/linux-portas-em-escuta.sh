#!/usr/bin/env bash
# ---
# id: linux-portas-em-escuta
# nome: "Linux - portas em escuta e processos"
# descricao: "Lista sockets TCP/UDP em escuta com o processo responsável."
# categoria: Rede
# so: [linux]
# shell: bash
# tipo: auditoria
# tempo_limite: 120
# requer_admin: true
# tags: [portas, ss]
# variaveis: []
# ---

if command -v ss >/dev/null 2>&1; then ss -tulpn; else netstat -tulpn; fi
exit 0
