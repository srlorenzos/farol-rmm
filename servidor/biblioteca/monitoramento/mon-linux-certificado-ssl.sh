#!/usr/bin/env bash
# ---
# id: mon-linux-certificado-ssl
# nome: "Monitor - validade do certificado TLS de um host"
# descricao: "Conecta via openssl e alerta quando o certificado vence em breve."
# categoria: Monitoramento
# so: [linux]
# shell: bash
# tipo: monitor
# tempo_limite: 60
# requer_admin: false
# tags: [tls, certificados, monitor]
# variaveis:
#   - nome: HOST
#     rotulo: "Host"
#     tipo: texto
#     padrao: ""
#     obrigatorio: true
#     opcoes: []
#   - nome: PORTA
#     rotulo: "Porta"
#     tipo: numero
#     padrao: 443
#     obrigatorio: false
#     opcoes: []
#   - nome: ALERTA
#     rotulo: "Alerta (dias)"
#     tipo: numero
#     padrao: 30
#     obrigatorio: false
#     opcoes: []
#   - nome: CRITICO
#     rotulo: "Crítico (dias)"
#     tipo: numero
#     padrao: 7
#     obrigatorio: false
#     opcoes: []
# ---
f_num() { case "$1" in ''|*[!0-9]*) echo "$2";; *) echo "$1";; esac; }
f_status() { echo "FAROL_STATUS: $1 $2"; }

h="$FAROL_HOST"; p=$(f_num "$FAROL_PORTA" 443); a=$(f_num "$FAROL_ALERTA" 30); c=$(f_num "$FAROL_CRITICO" 7)
printf '%s' "$h" | grep -Eq '^[A-Za-z0-9._-]+$' || { echo "Host inválido."; exit 2; }
command -v openssl >/dev/null 2>&1 || { echo "openssl ausente."; exit 1; }
fim=$(echo | timeout 10 openssl s_client -servername "$h" -connect "$h:$p" 2>/dev/null | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)
[ -n "$fim" ] || { f_status critico "Não foi possível obter o certificado de $h:$p"; exit 0; }
dias=$(( ( $(date -d "$fim" +%s) - $(date +%s) ) / 86400 ))
msg="Certificado de $h expira em $dias dia(s) ($fim)"
if [ "$dias" -le "$c" ]; then f_status critico "$msg"; elif [ "$dias" -le "$a" ]; then f_status alerta "$msg"; else f_status ok "$msg"; fi
exit 0
