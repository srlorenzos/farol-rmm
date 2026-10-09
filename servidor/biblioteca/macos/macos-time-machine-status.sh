#!/usr/bin/env bash
# ---
# id: macos-time-machine-status
# nome: "macOS - status do Time Machine"
# descricao: "Mostra o destino, último backup e se há backup em andamento."
# categoria: macOS
# so: [macos]
# shell: bash
# tipo: auditoria
# tempo_limite: 120
# requer_admin: false
# tags: [backup, timemachine]
# variaveis: []
# ---

tmutil destinationinfo 2>&1 | head -8
echo "Último backup: $(tmutil latestbackup 2>&1)"
echo "Em andamento: $(tmutil status 2>/dev/null | grep -c 'Running = 1')"
exit 0
