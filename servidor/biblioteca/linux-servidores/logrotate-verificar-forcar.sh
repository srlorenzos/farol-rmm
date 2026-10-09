#!/usr/bin/env bash
# ---
# id: logrotate-verificar-forcar
# nome: "logrotate - verificar configuração e forçar rotação"
# descricao: "Testa as configurações do logrotate (dry-run) e, opcionalmente, força a rotação."
# categoria: Servidores Linux
# so: [linux]
# shell: bash
# tipo: acao
# tempo_limite: 300
# requer_admin: true
# tags: [logrotate, logs]
# variaveis:
#   - nome: FORCAR
#     rotulo: "Forçar rotação agora"
#     tipo: booleano
#     padrao: false
#     obrigatorio: false
#     opcoes: []
# ---
f_sim() { case "$(printf '%s' "$1" | tr 'A-Z' 'a-z')" in 1|true|sim|s|yes|y|verdadeiro) return 0;; *) return 1;; esac; }
f_root() { [ "$(id -u)" -eq 0 ] || { echo "ERRO: execute como root."; exit 1; }; }

f_root
command -v logrotate >/dev/null 2>&1 || { echo "logrotate não instalado."; exit 1; }
logrotate -d /etc/logrotate.conf 2>&1 | tail -20
if f_sim "$FAROL_FORCAR"; then logrotate -f /etc/logrotate.conf && echo "Rotação forçada."; fi
exit 0
