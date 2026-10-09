#!/usr/bin/env bash
# ---
# id: linux-ssh-status-servico
# nome: "Linux - SSH: status, porta e sessões"
# descricao: "Mostra se o sshd está ativo, portas, usuários permitidos e sessões SSH em andamento."
# categoria: Acesso remoto
# so: [linux]
# shell: bash
# tipo: auditoria
# tempo_limite: 120
# requer_admin: true
# tags: [ssh, acesso-remoto]
# variaveis: []
# ---

systemctl is-active ssh 2>/dev/null || systemctl is-active sshd 2>/dev/null
ss -tlnp 2>/dev/null | grep sshd
command -v sshd >/dev/null 2>&1 && sshd -T 2>/dev/null | grep -E '^(port|allowusers|allowgroups|permitrootlogin|passwordauthentication)'
echo "Sessões SSH:"; who | grep -E 'pts|ssh'
exit 0
