#!/usr/bin/env bash
# ---
# id: systemd-timers-agendados
# nome: "systemd - timers e cron agendados"
# descricao: "Lista timers systemd, crontabs de usuários e /etc/cron.* para visão completa das tarefas agendadas."
# categoria: Servidores Linux
# so: [linux]
# shell: bash
# tipo: auditoria
# tempo_limite: 120
# requer_admin: false
# tags: [cron, timers]
# variaveis: []
# ---

echo "== Timers systemd =="; systemctl list-timers --all --no-pager 2>/dev/null | head -30
echo "== /etc/crontab =="; grep -vE '^\s*#|^\s*$' /etc/crontab 2>/dev/null
echo "== /etc/cron.d =="; for f in /etc/cron.d/*; do [ -f "$f" ] && { echo "-- $f"; grep -vE '^\s*#|^\s*$' "$f"; }; done 2>/dev/null
echo "== crontabs de usuários =="
for u in $(cut -d: -f1 /etc/passwd); do c=$(crontab -l -u "$u" 2>/dev/null | grep -vE '^\s*#|^\s*$'); [ -n "$c" ] && { echo "-- $u"; echo "$c"; }; done
exit 0
