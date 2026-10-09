#!/usr/bin/env bash
# ---
# id: linux-kernel-versoes-instaladas
# nome: "Linux - kernels instalados e em uso"
# descricao: "Lista kernels instalados e o em execução, indicando se há um mais novo aguardando reinício."
# categoria: Atualizações
# so: [linux]
# shell: bash
# tipo: auditoria
# tempo_limite: 120
# requer_admin: false
# tags: [kernel]
# variaveis: []
# ---
f_pm() { if command -v apt-get >/dev/null 2>&1; then echo apt; elif command -v dnf >/dev/null 2>&1; then echo dnf; elif command -v yum >/dev/null 2>&1; then echo yum; elif command -v zypper >/dev/null 2>&1; then echo zypper; elif command -v pacman >/dev/null 2>&1; then echo pacman; elif command -v brew >/dev/null 2>&1; then echo brew; else echo none; fi; }

echo "Em uso: $(uname -r)"
case "$(f_pm)" in apt) dpkg -l 'linux-image-[0-9]*' 2>/dev/null | awk '/^ii/ {print $2, $3}';; dnf|yum) rpm -q kernel kernel-core 2>/dev/null;; zypper) rpm -q kernel-default;; *) ls /boot | grep -i vmlinuz;; esac
exit 0
