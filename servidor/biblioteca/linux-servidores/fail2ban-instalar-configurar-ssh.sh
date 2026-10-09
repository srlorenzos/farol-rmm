#!/usr/bin/env bash
# ---
# id: fail2ban-instalar-configurar-ssh
# nome: "fail2ban - instalar e proteger o SSH"
# descricao: "Instala o fail2ban e cria uma jail local para sshd (bantime, maxretry e findtime configuráveis). Idempotente."
# categoria: Servidores Linux
# so: [linux]
# shell: bash
# tipo: acao
# tempo_limite: 600
# requer_admin: true
# tags: [fail2ban, ssh, hardening]
# variaveis:
#   - nome: MAXRETRY
#     rotulo: "Tentativas antes do ban"
#     tipo: numero
#     padrao: 5
#     obrigatorio: false
#     opcoes: []
#   - nome: BANTIME
#     rotulo: "Tempo de banimento (minutos)"
#     tipo: numero
#     padrao: 60
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
f_pm() { if command -v apt-get >/dev/null 2>&1; then echo apt; elif command -v dnf >/dev/null 2>&1; then echo dnf; elif command -v yum >/dev/null 2>&1; then echo yum; elif command -v zypper >/dev/null 2>&1; then echo zypper; elif command -v pacman >/dev/null 2>&1; then echo pacman; elif command -v brew >/dev/null 2>&1; then echo brew; else echo none; fi; }
f_pm_install() { case "$(f_pm)" in apt) DEBIAN_FRONTEND=noninteractive apt-get install -y "$@";; dnf) dnf install -y "$@";; yum) yum install -y "$@";; zypper) zypper -n install "$@";; pacman) pacman -S --noconfirm "$@";; *) echo "ERRO: gerenciador de pacotes não suportado."; return 1;; esac; }
f_confirmar() { f_sim "$FAROL_CONFIRMAR"; }

f_root
if ! f_confirmar; then echo "Defina CONFIRMAR=true para instalar/configurar o fail2ban."; exit 0; fi
command -v fail2ban-client >/dev/null 2>&1 || { f_pm_install fail2ban || exit 1; }
mr=$(f_num "$FAROL_MAXRETRY" 5); bt=$(f_num "$FAROL_BANTIME" 60)
printf '[DEFAULT]\nbantime = %sm\nfindtime = 10m\nmaxretry = %s\n\n[sshd]\nenabled = true\n' "$bt" "$mr" > /etc/fail2ban/jail.d/farol-sshd.local
systemctl enable --now fail2ban
sleep 2; fail2ban-client status sshd
exit 0
