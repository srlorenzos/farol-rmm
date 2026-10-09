#!/usr/bin/env bash
# ---
# id: linux-bloquear-desbloquear-usuario
# nome: "Linux - bloquear, desbloquear ou expirar conta"
# descricao: "Bloqueia (passwd -l + shell nologin opcional), desbloqueia ou define expiração de uma conta. Recusa root e o usuário atual."
# categoria: Usuários e contas
# so: [linux]
# shell: bash
# tipo: acao
# tempo_limite: 60
# requer_admin: true
# tags: [usuarios, bloqueio]
# variaveis:
#   - nome: USUARIO
#     rotulo: "Usuário"
#     tipo: texto
#     padrao: ""
#     obrigatorio: true
#     opcoes: []
#   - nome: ACAO
#     rotulo: "Ação"
#     tipo: selecao
#     padrao: "bloquear"
#     obrigatorio: true
#     opcoes: [bloquear, desbloquear, expirar-agora]
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
id "$u" >/dev/null 2>&1 || { echo "Usuário inexistente."; exit 1; }
[ "$u" = root ] || [ "$u" = "$(logname 2>/dev/null)" ] && { echo "Recusado: usuário protegido."; exit 1; }
passwd -S "$u" 2>/dev/null
if ! f_confirmar; then echo "Defina CONFIRMAR=true para $FAROL_ACAO."; exit 0; fi
case "$FAROL_ACAO" in
  bloquear) usermod -L "$u"; chage -E 0 "$u"; pkill -KILL -u "$u" 2>/dev/null; echo "Bloqueado e sessões encerradas.";;
  desbloquear) usermod -U "$u"; chage -E -1 "$u"; echo "Desbloqueado.";;
  expirar-agora) chage -d 0 "$u"; echo "Troca de senha exigida no próximo login.";;
esac
exit 0
