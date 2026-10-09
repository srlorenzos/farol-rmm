#!/usr/bin/env bash
# ---
# id: linux-inventario-completo
# nome: "Linux - inventário completo (JSON)"
# descricao: "JSON com hostname, distro, kernel, CPU, RAM, discos, interfaces, pacotes e serviços ativos para CMDB."
# categoria: Inventário e auditoria
# so: [linux]
# shell: bash
# tipo: auditoria
# tempo_limite: 120
# requer_admin: false
# tags: [inventario, json]
# variaveis: []
# ---
f_pm() { if command -v apt-get >/dev/null 2>&1; then echo apt; elif command -v dnf >/dev/null 2>&1; then echo dnf; elif command -v yum >/dev/null 2>&1; then echo yum; elif command -v zypper >/dev/null 2>&1; then echo zypper; elif command -v pacman >/dev/null 2>&1; then echo pacman; elif command -v brew >/dev/null 2>&1; then echo brew; else echo none; fi; }

. /etc/os-release 2>/dev/null
esc() { printf '%s' "$1" | sed 's/\\/\\\\/g;s/"/\\"/g'; }
ips=$(ip -4 -o addr 2>/dev/null | awk '!/ lo / {printf "\"%s\",", $4}' | sed 's/,$//')
serial=$(cat /sys/class/dmi/id/product_serial 2>/dev/null)
disk=$(lsblk -dbno NAME,SIZE,TYPE 2>/dev/null | awk '$3=="disk" {printf "{\"nome\":\"%s\",\"gb\":%d},", $1, $2/1073741824}' | sed 's/,$//')
npk=$(case "$(f_pm)" in apt) dpkg -l | grep -c '^ii';; dnf|yum|zypper) rpm -qa | wc -l;; *) echo 0;; esac)
printf '{"host":"%s","so":"%s","kernel":"%s","fabricante":"%s","modelo":"%s","serial":"%s","cpu":"%s","cpus":%s,"ram_mb":%s,"ips":[%s],"discos":[%s],"pacotes":%s,"servicos_ativos":%s}\n' \
 "$(esc "$(hostname)")" "$(esc "$PRETTY_NAME")" "$(uname -r)" "$(esc "$(cat /sys/class/dmi/id/sys_vendor 2>/dev/null)")" "$(esc "$(cat /sys/class/dmi/id/product_name 2>/dev/null)")" "$(esc "$serial")" \
 "$(esc "$(grep -m1 'model name' /proc/cpuinfo | cut -d: -f2 | sed 's/^ //')")" "$(nproc)" "$(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo)" "$ips" "$disk" "$npk" "$(systemctl list-units --type=service --state=running --no-legend 2>/dev/null | wc -l)"
exit 0
