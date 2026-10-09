#!/usr/bin/env bash
# ---
# id: linux-resumo-servidor
# nome: "Resumo do servidor Linux"
# descricao: "Distribuição, kernel, uptime, CPU, memória, discos, IPs, serviços ativos e usuários logados em um relatório único."
# categoria: Servidores Linux
# so: [linux]
# shell: bash
# tipo: auditoria
# tempo_limite: 120
# requer_admin: false
# tags: [resumo, inventario]
# variaveis: []
# ---

. /etc/os-release 2>/dev/null
echo "Host: $(hostname -f 2>/dev/null || hostname)"
echo "SO: ${PRETTY_NAME:-desconhecido} | Kernel: $(uname -r) | Arq: $(uname -m)"
echo "Uptime: $(uptime -p 2>/dev/null) | Load: $(cut -d' ' -f1-3 /proc/loadavg)"
echo "CPU: $(grep -m1 'model name' /proc/cpuinfo | cut -d: -f2 | sed 's/^ //') x$(nproc)"
free -h | awk 'NR==2 {print "RAM: "$3" usados de "$2" ("$7" disponíveis)"}'
echo "--- Discos"; df -hP -x tmpfs -x devtmpfs -x squashfs -x overlay 2>/dev/null
echo "--- IPs"; ip -br addr 2>/dev/null | grep -v '^lo'
echo "--- Serviços ativos: $(systemctl list-units --type=service --state=running --no-legend 2>/dev/null | wc -l)"
echo "--- Usuários logados"; who 2>/dev/null
exit 0
