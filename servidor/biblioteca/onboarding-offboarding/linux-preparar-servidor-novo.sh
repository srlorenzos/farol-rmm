#!/usr/bin/env bash
# ---
# id: linux-preparar-servidor-novo
# nome: "Linux - preparar servidor novo (baseline)"
# descricao: "Instala utilitários básicos (curl, vim, htop, rsync, ca-certificates, unattended-upgrades/chrony), ajusta fuso e habilita sincronização de hora."
# categoria: Onboarding e offboarding
# so: [linux]
# shell: bash
# tipo: acao
# tempo_limite: 1800
# requer_admin: true
# tags: [onboarding, baseline]
# variaveis:
#   - nome: FUSO
#     rotulo: "Fuso horário"
#     tipo: texto
#     padrao: "America/Sao_Paulo"
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
f_root() { [ "$(id -u)" -eq 0 ] || { echo "ERRO: execute como root."; exit 1; }; }
f_pm() { if command -v apt-get >/dev/null 2>&1; then echo apt; elif command -v dnf >/dev/null 2>&1; then echo dnf; elif command -v yum >/dev/null 2>&1; then echo yum; elif command -v zypper >/dev/null 2>&1; then echo zypper; elif command -v pacman >/dev/null 2>&1; then echo pacman; elif command -v brew >/dev/null 2>&1; then echo brew; else echo none; fi; }
f_pm_install() { case "$(f_pm)" in apt) DEBIAN_FRONTEND=noninteractive apt-get install -y "$@";; dnf) dnf install -y "$@";; yum) yum install -y "$@";; zypper) zypper -n install "$@";; pacman) pacman -S --noconfirm "$@";; *) echo "ERRO: gerenciador de pacotes não suportado."; return 1;; esac; }
f_confirmar() { f_sim "$FAROL_CONFIRMAR"; }

f_root
if ! f_confirmar; then echo "Defina CONFIRMAR=true para aplicar o baseline."; exit 0; fi
[ "$(f_pm)" = apt ] && apt-get update -qq
f_pm_install curl vim htop rsync ca-certificates lsof net-tools 2>&1 | tail -3
[ -f "/usr/share/zoneinfo/${FAROL_FUSO:-America/Sao_Paulo}" ] && timedatectl set-timezone "${FAROL_FUSO:-America/Sao_Paulo}"
timedatectl set-ntp true 2>/dev/null
echo "Baseline aplicado: $(hostname), $(timedatectl show -p Timezone --value 2>/dev/null)"
exit 0
