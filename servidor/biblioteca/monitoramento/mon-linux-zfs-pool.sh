#!/usr/bin/env bash
# ---
# id: mon-linux-zfs-pool
# nome: "Monitor - saúde de pools ZFS"
# descricao: "Executa zpool status -x e alerta se algum pool não estiver ONLINE/saudável."
# categoria: Monitoramento
# so: [linux]
# shell: bash
# tipo: monitor
# tempo_limite: 60
# requer_admin: false
# tags: [zfs, monitor]
# variaveis: []
# ---
f_status() { echo "FAROL_STATUS: $1 $2"; }

command -v zpool >/dev/null 2>&1 || { f_status ok "ZFS não instalado"; exit 0; }
s=$(zpool status -x 2>&1)
if printf '%s' "$s" | grep -q 'all pools are healthy'; then f_status ok "Todos os pools ZFS saudáveis"; else f_status critico "ZFS: $(printf '%s' "$s" | head -3 | tr '\n' ' ')"; fi
exit 0
