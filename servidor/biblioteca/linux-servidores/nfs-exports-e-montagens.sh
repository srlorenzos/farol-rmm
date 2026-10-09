#!/usr/bin/env bash
# ---
# id: nfs-exports-e-montagens
# nome: "NFS - exports e montagens ativas"
# descricao: "Lista exports do servidor NFS, clientes conectados e montagens NFS/CIFS atuais."
# categoria: Servidores Linux
# so: [linux]
# shell: bash
# tipo: auditoria
# tempo_limite: 120
# requer_admin: false
# tags: [nfs, cifs]
# variaveis: []
# ---

echo "== /etc/exports =="; grep -vE '^\s*#|^\s*$' /etc/exports 2>/dev/null
command -v exportfs >/dev/null 2>&1 && { echo "== exportfs =="; exportfs -v; }
echo "== Montagens de rede =="; grep -E ' (nfs|nfs4|cifs) ' /proc/mounts
exit 0
