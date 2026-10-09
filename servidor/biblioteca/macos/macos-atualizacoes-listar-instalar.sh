#!/usr/bin/env bash
# ---
# id: macos-atualizacoes-listar-instalar
# nome: "macOS - listar ou instalar atualizações do sistema"
# descricao: "Lista atualizações disponíveis (softwareupdate -l) e, com confirmação, instala as recomendadas sem reiniciar."
# categoria: macOS
# so: [macos]
# shell: bash
# tipo: acao
# tempo_limite: 3600
# requer_admin: true
# tags: [atualizacoes, softwareupdate]
# variaveis:
#   - nome: INSTALAR
#     rotulo: "Instalar as recomendadas"
#     tipo: booleano
#     padrao: false
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
f_confirmar() { f_sim "$FAROL_CONFIRMAR"; }

softwareupdate -l 2>&1 | grep -vE '^$|Finding available'
if f_sim "$FAROL_INSTALAR" && f_confirmar; then [ "$(id -u)" -eq 0 ] || { echo "Requer root."; exit 1; }; softwareupdate -i -r --no-scan 2>&1 | tail -10; else echo "Somente listagem (INSTALAR=true e CONFIRMAR=true para instalar)."; fi
exit 0
