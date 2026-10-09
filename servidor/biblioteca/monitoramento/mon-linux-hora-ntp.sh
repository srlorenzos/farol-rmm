#!/usr/bin/env bash
# ---
# id: mon-linux-hora-ntp
# nome: "Monitor - sincronização de hora"
# descricao: "Verifica se o relógio está sincronizado (timedatectl / chronyc / ntpq) e o desvio."
# categoria: Monitoramento
# so: [linux]
# shell: bash
# tipo: monitor
# tempo_limite: 60
# requer_admin: false
# tags: [ntp, hora, monitor]
# variaveis: []
# ---
f_status() { echo "FAROL_STATUS: $1 $2"; }

if command -v chronyc >/dev/null 2>&1; then
  off=$(chronyc tracking 2>/dev/null | awk '/System time/ {printf "%.3f", $4}')
  [ -n "$off" ] && { if awk -v o="$off" 'BEGIN {exit !(o > 5)}'; then f_status critico "Desvio de ${off}s (chrony)"; elif awk -v o="$off" 'BEGIN {exit !(o > 1)}'; then f_status alerta "Desvio de ${off}s (chrony)"; else f_status ok "Desvio de ${off}s (chrony)"; fi; exit 0; }
fi
if command -v timedatectl >/dev/null 2>&1; then
  s=$(timedatectl show -p NTPSynchronized --value 2>/dev/null)
  if [ "$s" = "yes" ]; then f_status ok "Relógio sincronizado (timedatectl)"; else f_status alerta "Relógio NÃO sincronizado"; fi
  exit 0
fi
f_status alerta "Sem ferramenta de verificação de hora (chronyc/timedatectl)"
exit 0
