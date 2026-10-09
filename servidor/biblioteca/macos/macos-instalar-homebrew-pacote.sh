#!/usr/bin/env bash
# ---
# id: macos-instalar-homebrew-pacote
# nome: "macOS - instalar pacote via Homebrew"
# descricao: "Instala fórmula ou cask do Homebrew (como o usuário do console) caso o brew exista."
# categoria: macOS
# so: [macos]
# shell: bash
# tipo: acao
# tempo_limite: 1800
# requer_admin: false
# tags: [homebrew, instalacao]
# variaveis:
#   - nome: PACOTE
#     rotulo: "Nome da fórmula/cask"
#     tipo: texto
#     padrao: ""
#     obrigatorio: true
#     opcoes: []
#   - nome: CASK
#     rotulo: "É um cask (aplicativo)"
#     tipo: booleano
#     padrao: false
#     obrigatorio: false
#     opcoes: []
# ---
f_sim() { case "$(printf '%s' "$1" | tr 'A-Z' 'a-z')" in 1|true|sim|s|yes|y|verdadeiro) return 0;; *) return 1;; esac; }
f_nome_ok() { printf '%s' "$1" | grep -Eq '^[A-Za-z0-9][A-Za-z0-9._+:@-]*$'; }

p="$FAROL_PACOTE"; f_nome_ok "$p" || { echo "Pacote inválido."; exit 1; }
b=$(command -v brew || ls /opt/homebrew/bin/brew /usr/local/bin/brew 2>/dev/null | head -1)
[ -x "$b" ] || { echo "Homebrew não instalado."; exit 1; }
u=$(stat -f%Su /dev/console)
if f_sim "$FAROL_CASK"; then sudo -u "$u" "$b" install --cask "$p"; else sudo -u "$u" "$b" install "$p"; fi
exit $?
