#!/usr/bin/env bash
# ---
# id: mon-linux-certificado-arquivo
# nome: "Monitor - validade de certificado em arquivo"
# descricao: "Verifica a validade de um certificado PEM local (ex.: /etc/letsencrypt/live/dominio/cert.pem)."
# categoria: Monitoramento
# so: [linux]
# shell: bash
# tipo: monitor
# tempo_limite: 60
# requer_admin: false
# tags: [certificados, monitor]
# variaveis:
#   - nome: ARQUIVO
#     rotulo: "Caminho do certificado PEM"
#     tipo: texto
#     padrao: ""
#     obrigatorio: true
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

f="$FAROL_ARQUIVO"; a=$(f_num "$FAROL_ALERTA" 30); c=$(f_num "$FAROL_CRITICO" 7)
[ -r "$f" ] || { f_status critico "Certificado ilegível: $f"; exit 0; }
fim=$(openssl x509 -in "$f" -noout -enddate 2>/dev/null | cut -d= -f2)
[ -n "$fim" ] || { f_status critico "Arquivo não é um certificado válido"; exit 0; }
dias=$(( ( $(date -d "$fim" +%s) - $(date +%s) ) / 86400 ))
msg="Certificado expira em $dias dia(s) ($fim)"
if [ "$dias" -le "$c" ]; then f_status critico "$msg"; elif [ "$dias" -le "$a" ]; then f_status alerta "$msg"; else f_status ok "$msg"; fi
exit 0
