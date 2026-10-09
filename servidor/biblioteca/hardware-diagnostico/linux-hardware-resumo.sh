#!/usr/bin/env bash
# ---
# id: linux-hardware-resumo
# nome: "Linux - resumo de hardware"
# descricao: "Fabricante, modelo, serial (DMI), CPU, memória, placas PCI/USB e BIOS."
# categoria: Hardware e diagnóstico
# so: [linux]
# shell: bash
# tipo: auditoria
# tempo_limite: 120
# requer_admin: true
# tags: [hardware, dmi]
# variaveis: []
# ---

for f in sys_vendor product_name product_serial bios_version bios_date; do printf '%-16s %s\n' "$f" "$(cat /sys/class/dmi/id/$f 2>/dev/null || echo n/d)"; done
lscpu | grep -E 'Model name|Socket|Core|Thread|MHz'
free -h | head -2
command -v dmidecode >/dev/null 2>&1 && dmidecode -t memory 2>/dev/null | grep -E 'Size:|Speed:|Manufacturer:|Part Number' | grep -v 'No Module' | head -24
echo "--- PCI"; command -v lspci >/dev/null 2>&1 && lspci | head -20
echo "--- USB"; command -v lsusb >/dev/null 2>&1 && lsusb
exit 0
