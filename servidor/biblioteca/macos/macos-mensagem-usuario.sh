#!/usr/bin/env bash
# ---
# id: macos-mensagem-usuario
# nome: "macOS - exibir mensagem ao usuário"
# descricao: "Mostra uma notificação/diálogo na sessão do usuário do console."
# categoria: macOS
# so: [macos]
# shell: bash
# tipo: acao
# tempo_limite: 60
# requer_admin: true
# tags: [mensagem]
# variaveis:
#   - nome: MENSAGEM
#     rotulo: "Texto"
#     tipo: texto
#     padrao: ""
#     obrigatorio: true
#     opcoes: []
#   - nome: TITULO
#     rotulo: "Título"
#     tipo: texto
#     padrao: "Aviso da TI"
#     obrigatorio: false
#     opcoes: []
# ---

m=$(printf '%s' "$FAROL_MENSAGEM" | tr -d '"\\\n'); t=$(printf '%s' "${FAROL_TITULO:-Aviso da TI}" | tr -d '"\\\n')
[ -n "$m" ] || { echo "Informe a mensagem."; exit 1; }
u=$(stat -f%Su /dev/console); uid=$(id -u "$u")
launchctl asuser "$uid" osascript -e "display dialog \"$m\" with title \"$t\" buttons {\"OK\"} default button 1 giving up after 120"
exit 0
