#!/usr/bin/env bash
# ---
# id: macos-limpar-caches-usuario
# nome: "macOS - limpar caches do usuário e lixeira"
# descricao: "Mede e opcionalmente remove ~/Library/Caches e esvazia a lixeira do usuário do console. Simulação por padrão."
# categoria: macOS
# so: [macos]
# shell: bash
# tipo: acao
# tempo_limite: 600
# requer_admin: false
# tags: [limpeza, cache]
# variaveis:
#   - nome: SIMULAR
#     rotulo: "Modo simulação (não altera nada; use false para aplicar)"
#     tipo: booleano
#     padrao: true
#     obrigatorio: false
#     opcoes: []
# ---
f_simular() { case "$(printf '%s' "$FAROL_SIMULAR" | tr 'A-Z' 'a-z')" in 0|false|nao|não|n|no|falso) return 1;; *) return 0;; esac; }

u=$(stat -f%Su /dev/console); h=$(dscl . -read "/Users/$u" NFSHomeDirectory 2>/dev/null | awk '{print $2}')
[ -d "$h" ] || { echo "Home não encontrado."; exit 1; }
echo "Caches: $(du -sh "$h/Library/Caches" 2>/dev/null | cut -f1) | Lixeira: $(du -sh "$h/.Trash" 2>/dev/null | cut -f1)"
if f_simular; then echo "SIMULAÇÃO: nada removido."; exit 0; fi
find "$h/Library/Caches" -mindepth 1 -maxdepth 1 -exec rm -rf {} + 2>/dev/null
find "$h/.Trash" -mindepth 1 -maxdepth 1 -exec rm -rf {} + 2>/dev/null
echo "Limpo."
exit 0
