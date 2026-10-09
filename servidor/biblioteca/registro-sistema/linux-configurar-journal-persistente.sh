#!/usr/bin/env bash
# ---
# id: linux-configurar-journal-persistente
# nome: "Linux - tornar o journal persistente e limitado"
# descricao: "Cria /var/log/journal e define limites de tamanho/retenção do journald via drop-in."
# categoria: Registro e logs do sistema
# so: [linux]
# shell: bash
# tipo: acao
# tempo_limite: 60
# requer_admin: true
# tags: [journald, logs]
# variaveis:
#   - nome: MAX_MB
#     rotulo: "Limite de uso (MB)"
#     tipo: numero
#     padrao: 1000
#     obrigatorio: false
#     opcoes: []
#   - nome: CONFIRMAR
#     rotulo: "Digite true para confirmar a execução"
#     tipo: booleano
#     padrao: false
#     obrigatorio: false
#     opcoes: []
# ---
f_sim() { case "$(printf '%s' "$1" | tr 'A-Z' 'a-z')" in 1|true|sim|s|yes|y|verdadeiro) return 0;; *) return 1;; esac; }
f_num() { case "$1" in ''|*[!0-9]*) echo "$2";; *) echo "$1";; esac; }
f_root() { [ "$(id -u)" -eq 0 ] || { echo "ERRO: execute como root."; exit 1; }; }
f_confirmar() { f_sim "$FAROL_CONFIRMAR"; }

f_root
journalctl --disk-usage
if ! f_confirmar; then echo "Defina CONFIRMAR=true para configurar."; exit 0; fi
mkdir -p /var/log/journal /etc/systemd/journald.conf.d
printf '[Journal]\nStorage=persistent\nSystemMaxUse=%sM\nMaxRetentionSec=1month\n' "$(f_num "$FAROL_MAX_MB" 1000)" > /etc/systemd/journald.conf.d/farol.conf
systemctl restart systemd-journald && echo "journald reconfigurado."
exit 0
