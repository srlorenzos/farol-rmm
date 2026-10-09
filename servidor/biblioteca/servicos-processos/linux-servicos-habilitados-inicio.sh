#!/usr/bin/env bash
# ---
# id: linux-servicos-habilitados-inicio
# nome: "Linux - serviços habilitados na inicialização"
# descricao: "Lista serviços habilitados e portas associadas, destacando os que escutam em todas as interfaces."
# categoria: Serviços e processos
# so: [linux]
# shell: bash
# tipo: auditoria
# tempo_limite: 120
# requer_admin: false
# tags: [servicos, systemd]
# variaveis: []
# ---

systemctl list-unit-files --type=service --state=enabled --no-pager --no-legend | awk '{print $1}'
echo; echo "Escutando em todas as interfaces:"; ss -tlnH 2>/dev/null | awk '$4 ~ /^(0\.0\.0\.0|\*|\[::\]):/ {print $4}' | sort -u
exit 0
