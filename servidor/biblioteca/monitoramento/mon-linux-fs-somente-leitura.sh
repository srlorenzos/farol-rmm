#!/usr/bin/env bash
# ---
# id: mon-linux-fs-somente-leitura
# nome: "Monitor - filesystems montados somente leitura"
# descricao: "Detecta filesystems reais remontados como somente leitura após erro."
# categoria: Monitoramento
# so: [linux]
# shell: bash
# tipo: monitor
# tempo_limite: 60
# requer_admin: false
# tags: [filesystem, monitor]
# variaveis: []
# ---
f_status() { echo "FAROL_STATUS: $1 $2"; }

ro=$(awk '$4 ~ /(^|,)ro(,|$)/ && $3 !~ /^(squashfs|iso9660|tmpfs|devtmpfs|proc|sysfs|cgroup2?|overlay|fuse.*|autofs|bpf|tracefs|debugfs|securityfs|configfs|efivarfs|devpts|mqueue|hugetlbfs|pstore|binfmt_misc|nsfs|ramfs|fusectl|selinuxfs)$/ {print $2}' /proc/mounts | tr '\n' ' ')
if [ -n "$ro" ]; then f_status critico "Somente leitura: $ro"; else f_status ok "Nenhum filesystem somente leitura"; fi
exit 0
