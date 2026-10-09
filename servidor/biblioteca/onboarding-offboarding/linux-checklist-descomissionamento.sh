#!/usr/bin/env bash
# ---
# id: linux-checklist-descomissionamento
# nome: "Linux - checklist de descomissionamento"
# descricao: "Relatório do que precisa ser tratado antes de desligar um servidor: serviços, portas, cron, containers, montagens, usuários e backups recentes."
# categoria: Onboarding e offboarding
# so: [linux]
# shell: bash
# tipo: auditoria
# tempo_limite: 120
# requer_admin: true
# tags: [offboarding, servidor]
# variaveis: []
# ---

echo "Host: $(hostname) | $(hostname -I 2>/dev/null)"
echo "== Serviços em execução"; systemctl list-units --type=service --state=running --no-legend --no-pager | awk '{print " "$1}' | grep -vE 'systemd|dbus|getty|user@|cron|rsyslog|ssh' | head -30
echo "== Portas em escuta"; ss -tlnH | awk '{print " "$4}' | sort -u
echo "== Containers"; command -v docker >/dev/null 2>&1 && docker ps --format ' {{.Names}} ({{.Image}})'
echo "== Montagens de rede"; grep -E ' (nfs|nfs4|cifs) ' /proc/mounts
echo "== Cron de usuários"; ls /var/spool/cron* 2>/dev/null
echo "== Usuários humanos"; awk -F: '$3>=1000 && $7 !~ /nologin|false/ {print " "$1}' /etc/passwd
exit 0
