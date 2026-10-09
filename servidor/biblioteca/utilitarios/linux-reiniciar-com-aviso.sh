#!/usr/bin/env bash
# ---
# id: linux-reiniciar-com-aviso
# nome: "Linux - reiniciar com aviso aos usuários"
# descricao: "Agenda reinício do servidor com mensagem para os usuários logados (shutdown -r +N). Pode ser cancelado com shutdown -c."
# categoria: Utilitários
# so: [linux]
# shell: bash
# tipo: acao
# tempo_limite: 60
# requer_admin: true
# tags: [reinicio]
# variaveis:
#   - nome: MINUTOS
#     rotulo: "Minutos até reiniciar"
#     tipo: numero
#     padrao: 10
#     obrigatorio: false
#     opcoes: []
#   - nome: MOTIVO
#     rotulo: "Mensagem"
#     tipo: texto
#     padrao: "Reinício programado pela TI"
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
f_num() { case "$1" in ''|*[!0-9]*) echo "$2";; *) echo "$1";; esac; }
f_root() { [ "$(id -u)" -eq 0 ] || { echo "ERRO: execute como root."; exit 1; }; }
f_confirmar() { f_sim "$FAROL_CONFIRMAR"; }

f_root
m=$(f_num "$FAROL_MINUTOS" 10); msg=$(printf '%s' "${FAROL_MOTIVO:-Reinício programado pela TI}" | tr -d '\n"`$')
if ! f_confirmar; then echo "Defina CONFIRMAR=true para reiniciar em $m minuto(s)."; exit 0; fi
shutdown -r +"$m" "$msg"
echo "Reinício agendado em $m minuto(s). Cancele com: shutdown -c"
exit 0
