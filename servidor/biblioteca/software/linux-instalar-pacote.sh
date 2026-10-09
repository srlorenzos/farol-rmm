#!/usr/bin/env bash
# ---
# id: linux-instalar-pacote
# nome: "Linux - instalar pacote"
# descricao: "Instala um pacote pelo nome usando o gerenciador detectado (apt/dnf/yum/zypper/pacman). Idempotente."
# categoria: Software
# so: [linux]
# shell: bash
# tipo: acao
# tempo_limite: 1200
# requer_admin: true
# tags: [pacotes, instalacao]
# variaveis:
#   - nome: PACOTE
#     rotulo: "Nome do pacote (vários separados por espaço)"
#     tipo: texto
#     padrao: ""
#     obrigatorio: true
#     opcoes: []
# ---
f_root() { [ "$(id -u)" -eq 0 ] || { echo "ERRO: execute como root."; exit 1; }; }
f_pm() { if command -v apt-get >/dev/null 2>&1; then echo apt; elif command -v dnf >/dev/null 2>&1; then echo dnf; elif command -v yum >/dev/null 2>&1; then echo yum; elif command -v zypper >/dev/null 2>&1; then echo zypper; elif command -v pacman >/dev/null 2>&1; then echo pacman; elif command -v brew >/dev/null 2>&1; then echo brew; else echo none; fi; }
f_pm_install() { case "$(f_pm)" in apt) DEBIAN_FRONTEND=noninteractive apt-get install -y "$@";; dnf) dnf install -y "$@";; yum) yum install -y "$@";; zypper) zypper -n install "$@";; pacman) pacman -S --noconfirm "$@";; *) echo "ERRO: gerenciador de pacotes não suportado."; return 1;; esac; }
f_nome_ok() { printf '%s' "$1" | grep -Eq '^[A-Za-z0-9][A-Za-z0-9._+:@-]*$'; }

f_root
for p in $FAROL_PACOTE; do f_nome_ok "$p" || { echo "Nome de pacote inválido: $p"; exit 1; }; done
[ -n "$FAROL_PACOTE" ] || { echo "Informe PACOTE."; exit 1; }
[ "$(f_pm)" = apt ] && apt-get update -qq
# shellcheck disable=SC2086
f_pm_install $FAROL_PACOTE
exit $?
