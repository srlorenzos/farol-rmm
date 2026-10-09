#!/usr/bin/env bash
# ---
# id: linux-clamav-instalar-e-escanear
# nome: "Linux - ClamAV (instalar, atualizar e escanear)"
# descricao: "Instala o ClamAV se necessário, atualiza assinaturas (freshclam) e escaneia um diretório, listando infectados. Não remove arquivos."
# categoria: Antivírus e Defender
# so: [linux]
# shell: bash
# tipo: acao
# tempo_limite: 7200
# requer_admin: true
# tags: [clamav, antivirus, scan]
# variaveis:
#   - nome: CAMINHO
#     rotulo: "Diretório a escanear"
#     tipo: texto
#     padrao: "/home"
#     obrigatorio: false
#     opcoes: []
#   - nome: INSTALAR
#     rotulo: "Instalar o ClamAV se ausente"
#     tipo: booleano
#     padrao: false
#     obrigatorio: false
#     opcoes: []
# ---
f_sim() { case "$(printf '%s' "$1" | tr 'A-Z' 'a-z')" in 1|true|sim|s|yes|y|verdadeiro) return 0;; *) return 1;; esac; }
f_root() { [ "$(id -u)" -eq 0 ] || { echo "ERRO: execute como root."; exit 1; }; }
f_pm() { if command -v apt-get >/dev/null 2>&1; then echo apt; elif command -v dnf >/dev/null 2>&1; then echo dnf; elif command -v yum >/dev/null 2>&1; then echo yum; elif command -v zypper >/dev/null 2>&1; then echo zypper; elif command -v pacman >/dev/null 2>&1; then echo pacman; elif command -v brew >/dev/null 2>&1; then echo brew; else echo none; fi; }
f_pm_install() { case "$(f_pm)" in apt) DEBIAN_FRONTEND=noninteractive apt-get install -y "$@";; dnf) dnf install -y "$@";; yum) yum install -y "$@";; zypper) zypper -n install "$@";; pacman) pacman -S --noconfirm "$@";; *) echo "ERRO: gerenciador de pacotes não suportado."; return 1;; esac; }

f_root
if ! command -v clamscan >/dev/null 2>&1; then
  f_sim "$FAROL_INSTALAR" || { echo "ClamAV não instalado (INSTALAR=true para instalar)."; exit 1; }
  case "$(f_pm)" in apt) f_pm_install clamav clamav-freshclam;; dnf|yum) f_pm_install clamav clamav-update;; *) f_pm_install clamav;; esac || exit 1
fi
c="${FAROL_CAMINHO:-/home}"; [ -d "$c" ] || { echo "Diretório inexistente."; exit 1; }
systemctl stop clamav-freshclam 2>/dev/null; freshclam 2>&1 | tail -3; systemctl start clamav-freshclam 2>/dev/null
clamscan -r -i --exclude-dir='^/(sys|proc|dev)' "$c"
rc=$?; [ "$rc" -eq 1 ] && echo "ATENÇÃO: ameaças encontradas (nada foi removido)."
exit 0
