#!/usr/bin/env bash
# ---
# id: fail2ban-status-e-desbanir
# nome: "fail2ban - status das jails e desbanir IP"
# descricao: "Lista jails, IPs banidos e permite remover o banimento de um IP específico."
# categoria: Servidores Linux
# so: [linux]
# shell: bash
# tipo: acao
# tempo_limite: 60
# requer_admin: true
# tags: [fail2ban]
# variaveis:
#   - nome: DESBANIR_IP
#     rotulo: "IP a desbanir (opcional)"
#     tipo: texto
#     padrao: ""
#     obrigatorio: false
#     opcoes: []
#   - nome: JAIL
#     rotulo: "Jail do IP"
#     tipo: texto
#     padrao: "sshd"
#     obrigatorio: false
#     opcoes: []
# ---
f_root() { [ "$(id -u)" -eq 0 ] || { echo "ERRO: execute como root."; exit 1; }; }
f_nome_ok() { printf '%s' "$1" | grep -Eq '^[A-Za-z0-9][A-Za-z0-9._+:@-]*$'; }

f_root
command -v fail2ban-client >/dev/null 2>&1 || { echo "fail2ban não instalado."; exit 1; }
if [ -n "$FAROL_DESBANIR_IP" ]; then
  printf '%s' "$FAROL_DESBANIR_IP" | grep -Eq '^[0-9a-fA-F:.]+$' || { echo "IP inválido."; exit 1; }
  j="${FAROL_JAIL:-sshd}"; f_nome_ok "$j" || { echo "Jail inválida."; exit 1; }
  fail2ban-client set "$j" unbanip "$FAROL_DESBANIR_IP"
fi
fail2ban-client status
for j in $(fail2ban-client status | awk -F: '/Jail list/ {gsub(/,/," ",$2); print $2}'); do echo "--- $j"; fail2ban-client status "$j"; done
exit 0
