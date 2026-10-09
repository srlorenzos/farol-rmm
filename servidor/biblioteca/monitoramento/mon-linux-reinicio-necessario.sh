#!/usr/bin/env bash
# ---
# id: mon-linux-reinicio-necessario
# nome: "Monitor - reinício necessário"
# descricao: "Detecta reinício pendente (Debian/Ubuntu reboot-required, RHEL needs-restarting) e kernel em uso diferente do instalado."
# categoria: Monitoramento
# so: [linux]
# shell: bash
# tipo: monitor
# tempo_limite: 60
# requer_admin: false
# tags: [reinicio, kernel, monitor]
# variaveis: []
# ---
f_status() { echo "FAROL_STATUS: $1 $2"; }

if [ -f /var/run/reboot-required ]; then f_status alerta "Reinício necessário ($(tr '\n' ' ' </var/run/reboot-required.pkgs 2>/dev/null | cut -c1-80))"; exit 0; fi
if command -v needs-restarting >/dev/null 2>&1; then
  needs-restarting -r >/dev/null 2>&1 || { f_status alerta "Reinício necessário (needs-restarting)"; exit 0; }
fi
f_status ok "Sem reinício pendente (kernel $(uname -r))"
exit 0
