#!/usr/bin/env bash
# ---
# id: linux-teste-memoria-rapido
# nome: "Linux - verificar erros de memória (EDAC/MCE)"
# descricao: "Procura erros corrigidos/não corrigidos de memória em EDAC e no log do kernel (MCE)."
# categoria: Hardware e diagnóstico
# so: [linux]
# shell: bash
# tipo: auditoria
# tempo_limite: 120
# requer_admin: true
# tags: [memoria, edac]
# variaveis: []
# ---

for f in /sys/devices/system/edac/mc/mc*/ce_count /sys/devices/system/edac/mc/mc*/ue_count; do [ -r "$f" ] && echo "$f = $(cat "$f")"; done
(journalctl -k --no-pager 2>/dev/null || dmesg) | grep -iE 'EDAC|Machine check|MCE|hardware error' | tail -10
echo "(Para teste profundo use memtester ou memtest86+ no boot.)"
exit 0
