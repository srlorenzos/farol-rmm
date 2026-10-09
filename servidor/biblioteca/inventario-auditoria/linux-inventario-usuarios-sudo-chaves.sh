#!/usr/bin/env bash
# ---
# id: linux-inventario-usuarios-sudo-chaves
# nome: "Linux - acessos privilegiados (sudo e chaves SSH)"
# descricao: "Lista quem tem sudo, entradas em /etc/sudoers.d, chaves autorizadas por usuário e arquivos SUID incomuns."
# categoria: Inventário e auditoria
# so: [linux]
# shell: bash
# tipo: auditoria
# tempo_limite: 300
# requer_admin: true
# tags: [privilegios, auditoria]
# variaveis: []
# ---

echo "== sudo/wheel"; getent group sudo wheel | cut -d: -f1,4
echo "== sudoers"; grep -rhE '^[^#].*(ALL|NOPASSWD)' /etc/sudoers /etc/sudoers.d 2>/dev/null
echo "== Chaves autorizadas"; for h in $(cut -d: -f6 /etc/passwd | sort -u); do [ -s "$h/.ssh/authorized_keys" ] && echo "$h: $(awk '!/^#/ && NF {c++} END {print c+0}' "$h/.ssh/authorized_keys") chave(s)"; done
echo "== SUID fora do padrão"; find / -xdev -perm -4000 -type f 2>/dev/null | grep -vE '^/(usr|bin|sbin)/(bin|sbin|lib|libexec)/(sudo|su|passwd|mount|umount|ping|chsh|chfn|newgrp|gpasswd|pkexec|fusermount3?|unix_chkpwd|crontab|at|ssh-keysign|dbus-daemon-launch-helper)$' | head -20
exit 0
