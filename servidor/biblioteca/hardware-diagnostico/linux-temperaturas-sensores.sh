#!/usr/bin/env bash
# ---
# id: linux-temperaturas-sensores
# nome: "Linux - temperaturas e ventiladores"
# descricao: "Lê sensores (lm-sensors) e zonas térmicas do kernel."
# categoria: Hardware e diagnóstico
# so: [linux]
# shell: bash
# tipo: auditoria
# tempo_limite: 120
# requer_admin: false
# tags: [temperatura, sensores]
# variaveis: []
# ---

command -v sensors >/dev/null 2>&1 && sensors 2>/dev/null || echo "lm-sensors não instalado."
for z in /sys/class/thermal/thermal_zone*; do [ -r "$z/temp" ] && echo "$(cat "$z/type"): $(( $(cat "$z/temp") / 1000 )) C"; done
exit 0
