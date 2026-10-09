#!/usr/bin/env bash
# ---
# id: linux-criar-usuario
# nome: "Linux - criar usuário"
# descricao: "Cria um usuário com shell e home, senha temporária com troca obrigatória e (opcional) grupo sudo/wheel. Idempotente."
# categoria: Usuários e contas
# so: [linux]
# shell: bash
# tipo: acao
# tempo_limite: 60
# requer_admin: true
# tags: [usuarios]
# variaveis:
#   - nome: USUARIO
#     rotulo: "Usuário"
#     tipo: texto
#     padrao: ""
#     obrigatorio: true
#     opcoes: []
#   - nome: SENHA
#     rotulo: "Senha temporária"
#     tipo: senha
#     padrao: ""
#     obrigatorio: true
#     opcoes: []
#   - nome: SUDO
#     rotulo: "Adicionar ao sudo/wheel"
#     tipo: booleano
#     padrao: false
#     obrigatorio: false
#     opcoes: []
# ---
f_sim() { case "$(printf '%s' "$1" | tr 'A-Z' 'a-z')" in 1|true|sim|s|yes|y|verdadeiro) return 0;; *) return 1;; esac; }
f_root() { [ "$(id -u)" -eq 0 ] || { echo "ERRO: execute como root."; exit 1; }; }

f_root
u="$FAROL_USUARIO"; printf '%s' "$u" | grep -Eq '^[a-z_][a-z0-9_-]{0,31}$' || { echo "Nome inválido (minúsculas, 1-32)."; exit 1; }
[ -n "$FAROL_SENHA" ] || { echo "Senha obrigatória."; exit 1; }
if id "$u" >/dev/null 2>&1; then echo "Usuário $u já existe."; exit 0; fi
useradd -m -s /bin/bash "$u" || exit 1
printf '%s:%s\n' "$u" "$FAROL_SENHA" | chpasswd && chage -d 0 "$u"
if f_sim "$FAROL_SUDO"; then g=sudo; getent group sudo >/dev/null || g=wheel; usermod -aG "$g" "$u" && echo "Adicionado a $g."; fi
echo "Usuário $u criado (troca de senha no primeiro login)."
exit 0
