#!/usr/bin/env bash
# ---
# id: linux-remover-usuario
# nome: "Linux - remover usuário"
# descricao: "Remove um usuário e, opcionalmente, seu diretório home (com backup tar.gz prévio). Exige confirmação."
# categoria: Usuários e contas
# so: [linux]
# shell: bash
# tipo: acao
# tempo_limite: 600
# requer_admin: true
# tags: [usuarios, offboarding]
# variaveis:
#   - nome: USUARIO
#     rotulo: "Usuário"
#     tipo: texto
#     padrao: ""
#     obrigatorio: true
#     opcoes: []
#   - nome: APAGAR_HOME
#     rotulo: "Apagar o home"
#     tipo: booleano
#     padrao: false
#     obrigatorio: false
#     opcoes: []
#   - nome: BACKUP_DIR
#     rotulo: "Pasta de backup do home"
#     tipo: texto
#     padrao: "/var/backups/offboarding"
#     obrigatorio: false
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
u="$FAROL_USUARIO"; printf '%s' "$u" | grep -Eq '^[a-z_][a-z0-9_-]{0,31}$' || { echo "Nome inválido."; exit 1; }
[ "$u" = root ] && { echo "Recusado."; exit 1; }
id "$u" >/dev/null 2>&1 || { echo "Usuário inexistente."; exit 0; }
if ! f_confirmar; then echo "Defina CONFIRMAR=true para remover $u."; exit 0; fi
h=$(getent passwd "$u" | cut -d: -f6); pkill -KILL -u "$u" 2>/dev/null
if f_sim "$FAROL_APAGAR_HOME" && [ -d "$h" ]; then
  b="${FAROL_BACKUP_DIR:-/var/backups/offboarding}"; mkdir -p "$b"; tar -czf "$b/$u-$(date +%Y%m%d).tar.gz" -C "$(dirname "$h")" "$(basename "$h")" && echo "Backup em $b/$u-$(date +%Y%m%d).tar.gz"
  userdel -r "$u"
else userdel "$u"; fi
echo "Usuário $u removido."
exit 0
