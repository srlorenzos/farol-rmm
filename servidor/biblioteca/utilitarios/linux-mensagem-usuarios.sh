#!/usr/bin/env bash
# ---
# id: linux-mensagem-usuarios
# nome: "Linux - enviar mensagem aos usuários logados"
# descricao: "Envia mensagem (wall) a todos os terminais abertos."
# categoria: Utilitários
# so: [linux]
# shell: bash
# tipo: acao
# tempo_limite: 30
# requer_admin: true
# tags: [mensagem]
# variaveis:
#   - nome: MENSAGEM
#     rotulo: "Texto"
#     tipo: texto
#     padrao: ""
#     obrigatorio: true
#     opcoes: []
# ---

m=$(printf '%s' "$FAROL_MENSAGEM" | tr -d '\r' | head -c 500)
[ -n "$m" ] || { echo "Informe a mensagem."; exit 1; }
printf '%s\n' "$m" | wall
echo "Mensagem enviada."
exit 0
