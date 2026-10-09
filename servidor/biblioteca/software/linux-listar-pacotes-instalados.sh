#!/usr/bin/env bash
# ---
# id: linux-listar-pacotes-instalados
# nome: "Linux - listar pacotes instalados"
# descricao: "Lista pacotes instalados com versão (dpkg/rpm/pacman), com filtro opcional."
# categoria: Software
# so: [linux]
# shell: bash
# tipo: auditoria
# tempo_limite: 120
# requer_admin: false
# tags: [pacotes, inventario]
# variaveis:
#   - nome: FILTRO
#     rotulo: "Filtro (contém)"
#     tipo: texto
#     padrao: ""
#     obrigatorio: false
#     opcoes: []
# ---
f_pm() { if command -v apt-get >/dev/null 2>&1; then echo apt; elif command -v dnf >/dev/null 2>&1; then echo dnf; elif command -v yum >/dev/null 2>&1; then echo yum; elif command -v zypper >/dev/null 2>&1; then echo zypper; elif command -v pacman >/dev/null 2>&1; then echo pacman; elif command -v brew >/dev/null 2>&1; then echo brew; else echo none; fi; }

f="$FAROL_FILTRO"; [ -z "$f" ] || printf '%s' "$f" | grep -Eq '^[A-Za-z0-9._+-]+$' || { echo "Filtro inválido."; exit 1; }
case "$(f_pm)" in
  apt) dpkg-query -W -f='${Package} ${Version}\n';;
  dnf|yum|zypper) rpm -qa --qf '%{NAME} %{VERSION}-%{RELEASE}\n';;
  pacman) pacman -Q;;
  *) echo "Não suportado."; exit 1;;
esac | grep -i -- "${f:-.}" | sort
exit 0
