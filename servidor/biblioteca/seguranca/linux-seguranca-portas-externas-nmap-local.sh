#!/usr/bin/env bash
# ---
# id: linux-seguranca-portas-externas-nmap-local
# nome: "Linux - varredura das próprias portas (nmap)"
# descricao: "Executa nmap contra o próprio host (loopback e IP principal) para validar o que realmente responde na rede."
# categoria: Segurança
# so: [linux]
# shell: bash
# tipo: auditoria
# tempo_limite: 600
# requer_admin: false
# tags: [nmap, portas]
# variaveis: []
# ---

command -v nmap >/dev/null 2>&1 || { echo "nmap não instalado."; exit 1; }
ip=$(ip -4 -o addr | awk '!/ lo / {split($4,a,"/"); print a[1]; exit}')
echo "Varredura de $ip (top 1000 TCP):"; nmap -Pn -T4 --open "$ip" | grep -E '^[0-9]+/|Nmap scan'
exit 0
