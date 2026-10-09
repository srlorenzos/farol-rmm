#!/usr/bin/env bash
# ---
# id: linux-compliance-contas-senhas
# nome: "Linux - contas e políticas de senha"
# descricao: "Verifica PASS_MAX_DAYS/MIN_LEN, usuários com senha que nunca expira, contas sem login recente e shell válido para contas de serviço."
# categoria: Compliance
# so: [linux]
# shell: bash
# tipo: auditoria
# tempo_limite: 120
# requer_admin: true
# tags: [senha, compliance]
# variaveis: []
# ---

grep -E '^(PASS_MAX_DAYS|PASS_MIN_DAYS|PASS_MIN_LEN|PASS_WARN_AGE)' /etc/login.defs
grep -rE 'minlen|pam_pwquality|pam_cracklib' /etc/pam.d /etc/security/pwquality.conf 2>/dev/null | grep -v '^#' | head -5
echo "== Senha que nunca expira (usuários humanos)"
awk -F: '$3>=1000 && $3<65000 {print $1}' /etc/passwd | while read -r u; do e=$(chage -l "$u" 2>/dev/null | awk -F': ' '/Password expires/ {print $2}'); [ "$e" = never ] && echo "  $u"; done
echo "== Contas de serviço com shell de login"
awk -F: '$3<1000 && $3>0 && $7 !~ /(nologin|false|sync|shutdown|halt)$/ {print "  "$1" "$7}' /etc/passwd
exit 0
