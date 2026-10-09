#!/usr/bin/env bash
# ---
# id: macos-info-sistema
# nome: "macOS - informações do sistema"
# descricao: "Modelo, serial, versão do macOS, chip, memória, armazenamento, uptime e usuário do console."
# categoria: macOS
# so: [macos]
# shell: bash
# tipo: auditoria
# tempo_limite: 120
# requer_admin: false
# tags: [inventario, macos]
# variaveis: []
# ---

sw_vers
system_profiler SPHardwareDataType 2>/dev/null | grep -E 'Model Name|Model Identifier|Chip|Processor|Memory|Serial Number|Number of Cores'
echo "Uptime:$(uptime | sed 's/^.*up//;s/,.*users.*//')"
echo "Console: $(stat -f%Su /dev/console)"
df -h / | tail -1
exit 0
