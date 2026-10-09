#!/usr/bin/env bash
# ---
# id: linux-remover-pacote
# nome: "Linux - remover pacote"
# descricao: "Remove um pacote instalado. Exige confirmação."
# categoria: Software
# so: [linux]
# shell: bash
# tipo: acao
# tempo_limite: 600
# requer_admin: true
# tags: [pacotes, desinstalacao]
# variaveis:
#   - nome: PACOTE
#     rotulo: "Nome do pacote"
#     tipo: texto
#     padrao: ""
#     obrigatorio: true
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
f_pm_remove() { case "$(f_pm)" in apt) DEBIAN_FRONTEND=noninteractive apt-get remove -y "$@";; dnf) dnf remove -y "$@";; yum) yum remove -y "$@";; zypper) zypper -n remove "$@";; pacman) pacman -R --noconfirm "$@";; *) echo "ERRO: gerenciador de pacotes não suportado."; return 1;; esac; }
f_nome_ok() { printf '%s' "$1" | grep -Eq '^[A-Za-z0-9][A-Za-z0-9._+:@-]*$'; }
f_confirmar() { f_sim "$FAROL_CONFIRMAR"; }

f_root
for p in $FAROL_PACOTE; do f_nome_ok "$p" || { echo "Nome inválido: $p"; exit 1; }; done
[ -n "$FAROL_PACOTE" ] || { echo "Informe PACOTE."; exit 1; }
if ! f_confirmar; then echo "Defina CONFIRMAR=true para remover: $FAROL_PACOTE"; exit 0; fi
# shellcheck disable=SC2086
f_pm_remove $FAROL_PACOTE
exit $?
