#!/usr/bin/env bash
# ---
# id: linux-auditar-logs-autenticacao
# nome: "Linux - auditoria de logs de autenticação"
# descricao: "Resume logins SSH aceitos/falhos, uso de sudo e criação de usuários nas últimas horas."
# categoria: Registro e logs do sistema
# so: [linux]
# shell: bash
# tipo: auditoria
# tempo_limite: 120
# requer_admin: true
# tags: [ssh, sudo, auditoria]
# variaveis:
#   - nome: HORAS
#     rotulo: "Janela (horas)"
#     tipo: numero
#     padrao: 24
#     obrigatorio: false
#     opcoes: []
# ---
f_num() { case "$1" in ''|*[!0-9]*) echo "$2";; *) echo "$1";; esac; }

h=$(f_num "$FAROL_HORAS" 24)
if command -v journalctl >/dev/null 2>&1; then fonte=$(journalctl --since "$h hours ago" --no-pager 2>/dev/null); else fonte=$(cat /var/log/auth.log /var/log/secure 2>/dev/null); fi
echo "== Logins aceitos"; printf '%s\n' "$fonte" | grep -E 'Accepted (password|publickey)' | sed -E 's/.*(Accepted [a-z]+ for [^ ]+ from [^ ]+).*/\1/' | sort | uniq -c | sort -rn | head -10
echo "== Falhas por origem"; printf '%s\n' "$fonte" | grep -E 'Failed password' | grep -oE 'from [0-9a-fA-F:.]+' | sort | uniq -c | sort -rn | head -10
echo "== Uso de sudo"; printf '%s\n' "$fonte" | grep -E 'sudo:.*COMMAND' | tail -10
echo "== Usuários criados/removidos"; printf '%s\n' "$fonte" | grep -E 'new user|useradd|userdel' | tail -5
exit 0
