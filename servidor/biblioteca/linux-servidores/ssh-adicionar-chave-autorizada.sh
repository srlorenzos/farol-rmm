#!/usr/bin/env bash
# ---
# id: ssh-adicionar-chave-autorizada
# nome: "SSH - adicionar chave pública autorizada"
# descricao: "Adiciona uma chave pública ao authorized_keys de um usuário (idempotente), criando o diretório .ssh com permissões corretas."
# categoria: Servidores Linux
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
#     padrao: ""
#     obrigatorio: true
#     opcoes: []
#   - nome: CHAVE
#     rotulo: "Chave pública completa"
#     tipo: texto
#     padrao: ""
#     obrigatorio: true
#     opcoes: []
# ---
f_root() { [ "$(id -u)" -eq 0 ] || { echo "ERRO: execute como root."; exit 1; }; }

f_root
u="$FAROL_USUARIO"; k="$FAROL_CHAVE"
id "$u" >/dev/null 2>&1 || { echo "Usuário inexistente."; exit 1; }
printf '%s' "$k" | grep -Eq '^(ssh-(rsa|ed25519)|ecdsa-sha2-nistp[0-9]+|sk-[a-z0-9@.-]+) [A-Za-z0-9+/=]+( [^[:cntrl:]]*)?$' || { echo "Chave pública inválida."; exit 1; }
h=$(getent passwd "$u" | cut -d: -f6)
mkdir -p "$h/.ssh"; touch "$h/.ssh/authorized_keys"
if grep -qF -- "$k" "$h/.ssh/authorized_keys"; then echo "Chave já presente."; else printf '%s\n' "$k" >> "$h/.ssh/authorized_keys"; echo "Chave adicionada."; fi
chown -R "$u": "$h/.ssh"; chmod 700 "$h/.ssh"; chmod 600 "$h/.ssh/authorized_keys"
exit 0
