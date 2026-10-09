#!/usr/bin/env bash
# ---
# id: linux-usuarios-listar
# nome: "Linux - listar usuários e privilégios"
# descricao: "Lista contas com shell de login, UID, último login, expiração de senha e membros de sudo/wheel."
# categoria: Usuários e contas
# so: [linux]
# shell: bash
# tipo: auditoria
# tempo_limite: 120
# requer_admin: true
# tags: [usuarios, sudo]
# variaveis: []
# ---

echo "Usuários com shell de login:"
awk -F: '$7 !~ /(nologin|false|sync|shutdown|halt)$/ && $3 >= 0 {print $1, $3, $6, $7}' /etc/passwd | while read -r u uid h sh; do
  ult=$(lastlog -u "$u" 2>/dev/null | awk 'NR==2 {$1=""; print}' | sed 's/^ *//'); exp=$(chage -l "$u" 2>/dev/null | awk -F': ' '/Password expires/ {print $2}')
  printf '%-16s uid=%-6s ult.login=%s senha_expira=%s\n' "$u" "$uid" "${ult:-n/d}" "${exp:-n/d}"
done
echo "--- sudo/wheel/admin"; getent group sudo wheel admin | cut -d: -f1,4
echo "--- /etc/sudoers.d"; ls /etc/sudoers.d 2>/dev/null
exit 0
