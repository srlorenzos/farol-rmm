#!/usr/bin/env bash
# ---
# id: docker-resumo
# nome: "Docker - resumo de containers, imagens e volumes"
# descricao: "Lista containers, uso de recursos, imagens e consumo de disco do Docker."
# categoria: Servidores Linux
# so: [linux]
# shell: bash
# tipo: auditoria
# tempo_limite: 120
# requer_admin: false
# tags: [docker]
# variaveis: []
# ---

command -v docker >/dev/null 2>&1 || { echo "Docker não instalado."; exit 1; }
docker ps -a --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}'
echo; docker stats --no-stream --format 'table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}' 2>/dev/null
echo; docker system df
exit 0
