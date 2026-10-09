#!/usr/bin/env bash
# ---
# id: mon-linux-raid-mdadm
# nome: "Monitor - arrays RAID (mdadm)"
# descricao: "Verifica /proc/mdstat em busca de arrays degradados ou em reconstrução."
# categoria: Monitoramento
# so: [linux]
# shell: bash
# tipo: monitor
# tempo_limite: 60
# requer_admin: false
# tags: [raid, mdadm, monitor]
# variaveis: []
# ---
f_status() { echo "FAROL_STATUS: $1 $2"; }

[ -r /proc/mdstat ] || { f_status ok "Sem mdadm/RAID por software"; exit 0; }
grep -q '^md' /proc/mdstat || { f_status ok "Nenhum array md configurado"; exit 0; }
if grep -Eq '\[[U_]*_[U_]*\]' /proc/mdstat; then f_status critico "Array RAID degradado: $(grep -E '^md|\[[U_]*_[U_]*\]' /proc/mdstat | tr '\n' ' ' | cut -c1-120)"
elif grep -Eq 'resync|recovery|reshape' /proc/mdstat; then f_status alerta "RAID em sincronização: $(grep -E 'resync|recovery' /proc/mdstat | head -1 | sed 's/^ *//')"
else f_status ok "Arrays RAID saudáveis"; fi
exit 0
