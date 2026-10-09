#!/usr/bin/env bash
# ---
# id: linux-configurar-atualizacoes-automaticas
# nome: "Linux - habilitar atualizações automáticas de segurança"
# descricao: "Configura unattended-upgrades (Debian/Ubuntu) ou dnf-automatic (RHEL/Fedora) para aplicar patches de segurança automaticamente."
# categoria: Atualizações
# so: [linux]
# shell: bash
# tipo: acao
# tempo_limite: 600
# requer_admin: true
# tags: [atualizacoes, automacao]
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
if ! f_confirmar; then echo "Defina CONFIRMAR=true para habilitar."; exit 0; fi
case "$(f_pm)" in
  apt) f_pm_install unattended-upgrades apt-listchanges || exit 1
    printf 'APT::Periodic::Update-Package-Lists "1";\nAPT::Periodic::Unattended-Upgrade "1";\n' > /etc/apt/apt.conf.d/20auto-upgrades; systemctl enable --now unattended-upgrades; echo "unattended-upgrades ativo.";;
  dnf) f_pm_install dnf-automatic || exit 1
    sed -i 's/^apply_updates.*/apply_updates = yes/;s/^upgrade_type.*/upgrade_type = security/' /etc/dnf/automatic.conf; systemctl enable --now dnf-automatic.timer; echo "dnf-automatic ativo.";;
  *) echo "Não suportado automaticamente neste gerenciador."; exit 1;;
esac
exit 0
