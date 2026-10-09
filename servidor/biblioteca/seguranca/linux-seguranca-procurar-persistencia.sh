#!/usr/bin/env bash
# ---
# id: linux-seguranca-procurar-persistencia
# nome: "Linux - procurar persistência suspeita"
# descricao: "Examina cron, systemd (unidades fora de /lib), rc.local, ld.so.preload, authorized_keys e binários recentes em /tmp, relevante para resposta a incidentes."
# categoria: Segurança
# so: [linux]
# shell: bash
# tipo: auditoria
# tempo_limite: 300
# requer_admin: true
# tags: [incidente, persistencia]
# variaveis: []
# ---

echo "== ld.so.preload"; cat /etc/ld.so.preload 2>/dev/null || echo "(ausente: ok)"
echo "== Unidades systemd em /etc (recentes 30d)"; find /etc/systemd/system -type f -mtime -30 2>/dev/null | head
echo "== rc.local"; grep -vE '^\s*#|^\s*$' /etc/rc.local 2>/dev/null
echo "== Cron recente"; find /etc/cron* /var/spool/cron* -type f -mtime -30 2>/dev/null | head
echo "== Executáveis em /tmp /dev/shm /var/tmp"; find /tmp /dev/shm /var/tmp -type f -perm /111 2>/dev/null | head
echo "== authorized_keys alterados em 30d"; find / -xdev -name authorized_keys -mtime -30 2>/dev/null | head
echo "== Conexões de saída incomuns"; ss -tnp state established 2>/dev/null | awk 'NR>1 && $4 !~ /:(22|80|443|53)$/ {print}' | head -10
exit 0
