#!/usr/bin/env bash
# ---
# id: macos-mdm-perfis
# nome: "macOS - perfis de configuração e MDM"
# descricao: "Lista perfis instalados, status de inscrição no MDM e supervisão do dispositivo."
# categoria: macOS
# so: [macos]
# shell: bash
# tipo: auditoria
# tempo_limite: 120
# requer_admin: true
# tags: [mdm, perfis]
# variaveis: []
# ---

profiles status -type enrollment 2>&1
profiles list 2>&1 | head -30
exit 0
