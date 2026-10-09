#!/usr/bin/env bash
# ---
# id: linux-alterar-hostname
# nome: "Linux - alterar hostname"
# descricao: "Altera o hostname do servidor (valida RFC 1123) e atualiza /etc/hosts para o 127.0.1.1."
# categoria: Utilitários
# so: [linux]
# shell: bash
# tipo: acao
# tempo_limite: 60
# requer_admin: true
# tags: [hostname]
# variaveis:
#   - nome: NOVO_NOME
#     rotulo: "Novo hostname"
#     tipo: texto
#     padrao: ""
#     obrigatorio: true
#     opcoes: []
#   - nome: CONFIRMAR
#     rotulo: "Digite true para confirmar a execução"
#     tipo: booleano
#     padrao: false
#     obrigatorio: false
#     opcoes: []
# ---
f_sim() { case "$(printf '%s' "$1" | tr 'A-Z' 'a-z')" in 1|true|sim|s|yes|y|verdadeiro) return 0;; *) return 1;; esac; }
f_root() { [ "$(id -u)" -eq 0 ] || { echo "ERRO: execute como root."; exit 1; }; }
f_confirmar() { f_sim "$FAROL_CONFIRMAR"; }

f_root
n="$FAROL_NOVO_NOME"
printf '%s' "$n" | grep -Eq '^[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?$' || { echo "Hostname inválido."; exit 1; }
echo "Atual: $(hostname)"
[ "$(hostname)" = "$n" ] && { echo "Já é $n."; exit 0; }
if ! f_confirmar; then echo "Defina CONFIRMAR=true para renomear para $n."; exit 0; fi
hostnamectl set-hostname "$n"
if grep -q '^127.0.1.1' /etc/hosts; then sed -i "s/^127.0.1.1.*/127.0.1.1 $n/" /etc/hosts; fi
echo "Hostname: $(hostname)"
exit 0
