#!/usr/bin/env bash
# ---
# id: mon-linux-falhas-ssh
# nome: "Monitor - tentativas de login SSH com falha"
# descricao: "Conta falhas de autenticação SSH na última hora (journal ou auth.log)."
# categoria: Monitoramento
# so: [linux]
# shell: bash
# tipo: monitor
# tempo_limite: 60
# requer_admin: false
# tags: [ssh, forca-bruta, monitor]
# variaveis:
#   - nome: ALERTA
#     rotulo: "Alerta (falhas/hora)"
#     tipo: numero
#     padrao: 30
#     obrigatorio: false
#     opcoes: []
#   - nome: CRITICO
#     rotulo: "Crítico (falhas/hora)"
#     tipo: numero
#     padrao: 200
#     obrigatorio: false
#     opcoes: []
# ---
f_num() { case "$1" in ''|*[!0-9]*) echo "$2";; *) echo "$1";; esac; }
f_status() { echo "FAROL_STATUS: $1 $2"; }

a=$(f_num "$FAROL_ALERTA" 30); c=$(f_num "$FAROL_CRITICO" 200)
if command -v journalctl >/dev/null 2>&1 && journalctl -u ssh -u sshd --since "1 hour ago" -q >/dev/null 2>&1; then
  n=$(journalctl -u ssh -u sshd --since "1 hour ago" --no-pager 2>/dev/null | grep -Ec 'Failed password|Invalid user|authentication failure')
else
  log=/var/log/auth.log; [ -r "$log" ] || log=/var/log/secure
  [ -r "$log" ] || { f_status alerta "Sem acesso aos logs de autenticação"; exit 0; }
  n=$(grep -E "$(date -d '1 hour ago' '+%b %e %H'):|$(date '+%b %e %H'):" "$log" | grep -Ec 'Failed password|Invalid user|authentication failure')
fi
msg="$n falha(s) de login SSH na última hora"
if [ "$n" -ge "$c" ]; then f_status critico "$msg"; elif [ "$n" -ge "$a" ]; then f_status alerta "$msg"; else f_status ok "$msg"; fi
exit 0
