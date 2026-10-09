#!/usr/bin/env bash
# ---
# id: linux-bateria-notebook
# nome: "Linux - saúde da bateria"
# descricao: "Informa capacidade atual versus projeto, ciclos e estado da bateria de notebooks via /sys/class/power_supply."
# categoria: Hardware e diagnóstico
# so: [linux]
# shell: bash
# tipo: auditoria
# tempo_limite: 120
# requer_admin: false
# tags: [bateria]
# variaveis: []
# ---

achou=0
for b in /sys/class/power_supply/BAT*; do
  [ -d "$b" ] || continue; achou=1
  cf=$(cat "$b/energy_full" 2>/dev/null || cat "$b/charge_full" 2>/dev/null); cd=$(cat "$b/energy_full_design" 2>/dev/null || cat "$b/charge_full_design" 2>/dev/null)
  echo "$(basename "$b"): estado $(cat "$b/status"), carga $(cat "$b/capacity")%, ciclos $(cat "$b/cycle_count" 2>/dev/null || echo n/d)"
  [ -n "$cf" ] && [ -n "$cd" ] && echo "  Saúde: $(( cf * 100 / cd ))% da capacidade original"
done
[ "$achou" -eq 1 ] || echo "Nenhuma bateria detectada."
exit 0
