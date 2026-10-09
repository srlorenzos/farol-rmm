#!/usr/bin/env bash
# ---
# id: macos-contas-usuarios
# nome: "macOS - usuários locais e administradores"
# descricao: "Lista usuários locais (UID >= 500), administradores e usuário do console."
# categoria: macOS
# so: [macos]
# shell: bash
# tipo: auditoria
# tempo_limite: 120
# requer_admin: false
# tags: [usuarios, admin]
# variaveis: []
# ---

echo "Console: $(stat -f%Su /dev/console)"
echo "Usuários:"; dscl . -list /Users UniqueID | awk '$2 >= 500 {print "  "$1" (uid "$2")"}'
echo "Administradores:"; dscl . -read /Groups/admin GroupMembership | cut -d: -f2
exit 0
