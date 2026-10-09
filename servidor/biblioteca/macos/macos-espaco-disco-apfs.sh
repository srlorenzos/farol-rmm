#!/usr/bin/env bash
# ---
# id: macos-espaco-disco-apfs
# nome: "macOS - uso de disco APFS e snapshots"
# descricao: "Mostra volumes APFS, uso, e snapshots do Time Machine que ocupam espaço."
# categoria: macOS
# so: [macos]
# shell: bash
# tipo: auditoria
# tempo_limite: 120
# requer_admin: false
# tags: [disco, apfs, timemachine]
# variaveis: []
# ---

diskutil apfs list 2>/dev/null | grep -E 'Name|Capacity|Used|Free' | head -20
echo "--- Snapshots locais"; tmutil listlocalsnapshots / 2>/dev/null
df -h / | tail -1
exit 0
