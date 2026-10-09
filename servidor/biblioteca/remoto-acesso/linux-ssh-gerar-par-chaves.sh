#!/usr/bin/env bash
# ---
# id: linux-ssh-gerar-par-chaves
# nome: "Linux - gerar par de chaves SSH ed25519"
# descricao: "Gera um par de chaves ed25519 para um usuário (sem sobrescrever) e imprime a chave pública."
# categoria: Acesso remoto
# so: [linux]
# shell: bash
# tipo: acao
# tempo_limite: 60
# requer_admin: true
# tags: [ssh, chaves]
# variaveis:
#   - nome: USUARIO
#     rotulo: "Usuário"
#     tipo: texto
#     padrao: "root"
#     obrigatorio: false
#     opcoes: []
#   - nome: COMENTARIO
#     rotulo: "Comentário da chave"
#     tipo: texto
#     padrao: "farol"
#     obrigatorio: false
#     opcoes: []
# ---

u="${FAROL_USUARIO:-root}"; id "$u" >/dev/null 2>&1 || { echo "Usuário inexistente."; exit 1; }
c=$(printf '%s' "${FAROL_COMENTARIO:-farol}" | tr -c 'A-Za-z0-9@._-' '_')
h=$(getent passwd "$u" | cut -d: -f6); mkdir -p "$h/.ssh"; chmod 700 "$h/.ssh"
if [ -f "$h/.ssh/id_ed25519" ]; then echo "Chave já existe em $h/.ssh/id_ed25519"; else ssh-keygen -q -t ed25519 -N '' -C "$c" -f "$h/.ssh/id_ed25519"; fi
chown -R "$u": "$h/.ssh"; echo "Chave pública:"; cat "$h/.ssh/id_ed25519.pub"
exit 0
