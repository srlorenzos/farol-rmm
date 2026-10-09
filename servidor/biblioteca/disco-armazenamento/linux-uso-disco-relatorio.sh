#!/usr/bin/env bash
# ---
# id: linux-uso-disco-relatorio
# nome: "Linux - relatório de uso de disco"
# descricao: "Filesystems montados com uso, inodes, dispositivos de bloco e tipo (SSD/HDD)."
# categoria: Disco e armazenamento
# so: [linux]
# shell: bash
# tipo: auditoria
# tempo_limite: 120
# requer_admin: false
# tags: [disco]
# variaveis: []
# ---

df -hT -x tmpfs -x devtmpfs -x squashfs -x overlay 2>/dev/null
echo; df -iP -x tmpfs -x devtmpfs -x squashfs -x overlay 2>/dev/null | awk 'NR==1 || $5+0 > 50'
echo; lsblk -o NAME,SIZE,TYPE,ROTA,FSTYPE,MOUNTPOINT 2>/dev/null
exit 0
