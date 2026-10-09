#!/usr/bin/env bash
# ---
# id: ssh-auditar-configuracao
# nome: "SSH - auditoria da configuração do servidor"
# descricao: "Avalia sshd_config efetivo: root login, senha, protocolo, chaves, X11, MaxAuthTries, e lista usuários com authorized_keys."
# categoria: Servidores Linux
# so: [linux]
# shell: bash
# tipo: auditoria
# tempo_limite: 120
# requer_admin: true
# tags: [ssh, hardening]
# variaveis: []
# ---

if command -v sshd >/dev/null 2>&1; then cfg=$(sshd -T 2>/dev/null); else echo "sshd não encontrado."; exit 1; fi
for k in permitrootlogin passwordauthentication pubkeyauthentication permitemptypasswords x11forwarding maxauthtries logingracetime allowusers allowgroups port usepam; do printf '%-26s %s\n' "$k" "$(printf '%s' "$cfg" | awk -v k="$k" '$1==k {$1=""; print substr($0,2)}')"; done
echo "--- Avaliação"
printf '%s' "$cfg" | grep -q '^permitrootlogin yes' && echo "[FALHOU] Login root por SSH permitido"
printf '%s' "$cfg" | grep -q '^passwordauthentication yes' && echo "[ATENÇÃO] Autenticação por senha habilitada"
printf '%s' "$cfg" | grep -q '^permitemptypasswords yes' && echo "[FALHOU] Senhas vazias permitidas"
echo "--- Usuários com authorized_keys"
for h in $(cut -d: -f6 /etc/passwd | sort -u); do [ -s "$h/.ssh/authorized_keys" ] && echo "$h: $(grep -cvE '^\s*#|^\s*$' "$h/.ssh/authorized_keys") chave(s)"; done
exit 0
