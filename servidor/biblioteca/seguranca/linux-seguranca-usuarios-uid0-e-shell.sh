#!/usr/bin/env bash
# ---
# id: linux-seguranca-usuarios-uid0-e-shell
# nome: "Linux - contas privilegiadas e suspeitas"
# descricao: "Procura contas com UID 0 além de root, usuários sem senha, usuários recentes e shells incomuns."
# categoria: Segurança
# so: [linux]
# shell: bash
# tipo: auditoria
# tempo_limite: 120
# requer_admin: true
# tags: [contas, seguranca]
# variaveis: []
# ---

echo "UID 0:"; awk -F: '$3==0 {print "  "$1}' /etc/passwd
echo "Sem senha:"; awk -F: '$2=="" {print "  "$1}' /etc/shadow
echo "Shells incomuns:"; awk -F: '$7 !~ /(bash|sh|zsh|dash|fish|nologin|false|sync|shutdown|halt|git-shell)$/ {print "  "$1" "$7}' /etc/passwd
echo "Contas com alteração de senha nos últimos 7 dias:"; awk -F: -v h=$(( $(date +%s) / 86400 - 7 )) '$3>=1000 && $3<65000 && $3!=65534 && $3 > 0 {print $1}' /etc/passwd | while read -r u; do d=$(awk -F: -v u="$u" '$1==u {print $3}' /etc/shadow); [ -n "$d" ] && [ "$d" -ge "$h" ] && echo "  $u"; done
exit 0
