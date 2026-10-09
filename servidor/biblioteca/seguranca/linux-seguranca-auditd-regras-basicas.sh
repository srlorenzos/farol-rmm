#!/usr/bin/env bash
# ---
# id: linux-seguranca-auditd-regras-basicas
# nome: "Linux - instalar auditd com regras básicas"
# descricao: "Instala o auditd e adiciona regras de auditoria para alterações em identidades, sudoers, SSH e tempo do sistema."
# categoria: Segurança
# so: [linux]
# shell: bash
# tipo: acao
# tempo_limite: 600
# requer_admin: true
# tags: [auditd, auditoria]
# variaveis:
#   - nome: CONFIRMAR
#     rotulo: "Digite true para confirmar a execução"
#     tipo: booleano
#     padrao: false
#     obrigatorio: false
#     opcoes: []
# ---
f_sim() { case "$(printf '%s' "$1" | tr 'A-Z' 'a-z')" in 1|true|sim|s|yes|y|verdadeiro) return 0;; *) return 1;; esac; }
f_root() { [ "$(id -u)" -eq 0 ] || { echo "ERRO: execute como root."; exit 1; }; }
f_pm() { if command -v apt-get >/dev/null 2>&1; then echo apt; elif command -v dnf >/dev/null 2>&1; then echo dnf; elif command -v yum >/dev/null 2>&1; then echo yum; elif command -v zypper >/dev/null 2>&1; then echo zypper; elif command -v pacman >/dev/null 2>&1; then echo pacman; elif command -v brew >/dev/null 2>&1; then echo brew; else echo none; fi; }
f_pm_install() { case "$(f_pm)" in apt) DEBIAN_FRONTEND=noninteractive apt-get install -y "$@";; dnf) dnf install -y "$@";; yum) yum install -y "$@";; zypper) zypper -n install "$@";; pacman) pacman -S --noconfirm "$@";; *) echo "ERRO: gerenciador de pacotes não suportado."; return 1;; esac; }
f_confirmar() { f_sim "$FAROL_CONFIRMAR"; }

f_root
if ! f_confirmar; then echo "Defina CONFIRMAR=true para instalar e configurar o auditd."; exit 0; fi
command -v auditctl >/dev/null 2>&1 || { case "$(f_pm)" in apt) f_pm_install auditd;; *) f_pm_install audit;; esac || exit 1; }
cat > /etc/audit/rules.d/farol.rules <<'EOF'
-w /etc/passwd -p wa -k identidade
-w /etc/shadow -p wa -k identidade
-w /etc/group -p wa -k identidade
-w /etc/sudoers -p wa -k sudoers
-w /etc/sudoers.d/ -p wa -k sudoers
-w /etc/ssh/sshd_config -p wa -k ssh
-a always,exit -F arch=b64 -S adjtimex,settimeofday -k tempo
EOF
augenrules --load 2>/dev/null || service auditd restart
systemctl enable --now auditd; auditctl -l | head
exit 0
