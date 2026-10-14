#!/usr/bin/env bash
# ---
# id: macos-aplicativos-instalados
# nome: "macOS - aplicativos instalados"
# descricao: "Lista aplicativos em /Applications com versão."
# categoria: macOS
# so: [macos]
# shell: bash
# tipo: auditoria
# tempo_limite: 120
# requer_admin: false
# tags: [software, inventario]
# variaveis: []
# ---

for a in /Applications/*.app /Applications/*/*.app; do [ -d "$a" ] || continue; v=$(defaults read "$a/Contents/Info" CFBundleShortVersionString 2>/dev/null); printf '%-45s %s\n' "$(basename "$a" .app)" "${v:-?}"; done | sort
exit 0
