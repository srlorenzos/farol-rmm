#!/usr/bin/env bash
# ---
# id: linux-coletar-diagnostico
# nome: "Linux - coletar pacote de diagnóstico"
# descricao: "Reúne uname, os-release, dmesg, journal de erros, lsblk, rede, serviços e pacotes em um tar.gz para suporte."
# categoria: Registro e logs do sistema
# so: [linux]
# shell: bash
# tipo: auditoria
# tempo_limite: 300
# requer_admin: true
# tags: [diagnostico, suporte]
# variaveis:
#   - nome: DESTINO
#     rotulo: "Pasta de destino"
#     tipo: texto
#     padrao: "/tmp"
#     obrigatorio: false
#     opcoes: []
# ---
f_pm() { if command -v apt-get >/dev/null 2>&1; then echo apt; elif command -v dnf >/dev/null 2>&1; then echo dnf; elif command -v yum >/dev/null 2>&1; then echo yum; elif command -v zypper >/dev/null 2>&1; then echo zypper; elif command -v pacman >/dev/null 2>&1; then echo pacman; elif command -v brew >/dev/null 2>&1; then echo brew; else echo none; fi; }

d="${FAROL_DESTINO:-/tmp}"; mkdir -p "$d" || exit 1
w=$(mktemp -d); h=$(hostname)
{ uname -a; cat /etc/os-release; uptime; free -h; df -hP; lsblk; } > "$w/sistema.txt" 2>&1
ip addr > "$w/rede.txt" 2>&1; ip route >> "$w/rede.txt"; ss -tulpn >> "$w/rede.txt" 2>&1
systemctl list-units --type=service --no-pager > "$w/servicos.txt" 2>&1; systemctl --failed --no-pager >> "$w/servicos.txt" 2>&1
dmesg 2>/dev/null | tail -500 > "$w/dmesg.txt"
journalctl -p err --since "48 hours ago" --no-pager 2>/dev/null | tail -1000 > "$w/journal-erros.txt"
case "$(f_pm)" in apt) dpkg -l;; dnf|yum|zypper) rpm -qa;; esac > "$w/pacotes.txt" 2>&1
arq="$d/diagnostico-$h-$(date +%Y%m%d-%H%M).tar.gz"
tar -czf "$arq" -C "$w" . && echo "Pacote gerado: $arq ($(du -h "$arq" | cut -f1))"
rm -rf "$w"
exit 0
