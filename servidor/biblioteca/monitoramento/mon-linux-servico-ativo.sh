#!/usr/bin/env bash
# ---
# id: mon-linux-servico-ativo
# nome: "Monitor - serviços systemd ativos"
# descricao: "Verifica se os serviços systemd informados estão ativos; crítico se algum estiver parado ou falho."
# categoria: Monitoramento
# so: [linux]
# shell: bash
# tipo: monitor
# tempo_limite: 60
# requer_admin: false
# tags: [systemd, servicos, monitor]
# variaveis:
#   - nome: SERVICOS
#     rotulo: "Serviços separados por vírgula"
#     tipo: texto
#     padrao: "sshd,cron"
#     obrigatorio: true
#     opcoes: []
# ---
f_status() { echo "FAROL_STATUS: $1 $2"; }
f_nome_ok() { printf '%s' "$1" | grep -Eq '^[A-Za-z0-9][A-Za-z0-9._+:@-]*$'; }

lista=$(printf '%s' "$FAROL_SERVICOS" | tr ',' ' ')
[ -n "$lista" ] || { echo "Informe SERVICOS."; exit 2; }
falha=""
for s in $lista; do
  f_nome_ok "$s" || { echo "Nome inválido: $s"; exit 2; }
  if ! systemctl is-active --quiet "$s" 2>/dev/null; then
    alt=$(printf '%s' "$s" | sed 's/^sshd$/ssh/;s/^cron$/crond/')
    systemctl is-active --quiet "$alt" 2>/dev/null || falha="$falha $s($(systemctl is-active "$s" 2>/dev/null))"
  fi
done
if [ -n "$falha" ]; then f_status critico "Inativos:$falha"; else f_status ok "Ativos: $lista"; fi
exit 0
