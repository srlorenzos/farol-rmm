#!/usr/bin/env bash
# ---
# id: linux-instalar-docker
# nome: "Linux - instalar Docker Engine"
# descricao: "Instala o Docker Engine pelo repositório da distribuição (docker.io / docker-ce quando disponível) e habilita o serviço. Idempotente."
# categoria: Software
# so: [linux]
# shell: bash
# tipo: acao
# tempo_limite: 1200
# requer_admin: true
# tags: [docker, instalacao]
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
command -v docker >/dev/null 2>&1 && { echo "Docker já instalado: $(docker --version)"; exit 0; }
if ! f_confirmar; then echo "Defina CONFIRMAR=true para instalar o Docker."; exit 0; fi
case "$(f_pm)" in
  apt) apt-get update -qq; f_pm_install docker.io || exit 1;;
  dnf|yum) f_pm_install docker 2>/dev/null || f_pm_install moby-engine || exit 1;;
  zypper) f_pm_install docker || exit 1;;
  pacman) f_pm_install docker || exit 1;;
  *) echo "Não suportado."; exit 1;;
esac
systemctl enable --now docker && docker --version
exit 0
