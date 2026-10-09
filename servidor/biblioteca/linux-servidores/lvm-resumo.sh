#!/usr/bin/env bash
# ---
# id: lvm-resumo
# nome: "LVM - volumes físicos, grupos e lógicos"
# descricao: "Mostra PVs, VGs e LVs com tamanhos e espaço livre."
# categoria: Servidores Linux
# so: [linux]
# shell: bash
# tipo: auditoria
# tempo_limite: 120
# requer_admin: true
# tags: [lvm, armazenamento]
# variaveis: []
# ---

command -v lvs >/dev/null 2>&1 || { echo "LVM não instalado."; exit 1; }
pvs; echo; vgs; echo; lvs -o lv_name,vg_name,lv_size,lv_attr,data_percent,devices
exit 0
