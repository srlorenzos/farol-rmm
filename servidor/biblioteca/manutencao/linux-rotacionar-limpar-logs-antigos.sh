#!/usr/bin/env bash
# ---
# id: linux-rotacionar-limpar-logs-antigos
# nome: "Linux - remover logs rotacionados antigos"
# descricao: "Apaga logs comprimidos/rotacionados (*.gz, *.1, *.old) em /var/log mais antigos que N dias. Simulação por padrão."
# categoria: Manutenção
# so: [linux]
# shell: bash
# tipo: acao
# tempo_limite: 300
# requer_admin: true
# tags: [logs, limpeza]
# variaveis:
#   - nome: DIAS
#     rotulo: "Mais antigos que (dias)"
#     tipo: numero
#     padrao: 30
#     obrigatorio: false
#     opcoes: []
#   - nome: SIMULAR
#     rotulo: "Modo simulação (não altera nada; use false para aplicar)"
#     tipo: booleano
#     padrao: true
#     obrigatorio: false
#     opcoes: []
# ---
f_num() { case "$1" in ''|*[!0-9]*) echo "$2";; *) echo "$1";; esac; }
f_root() { [ "$(id -u)" -eq 0 ] || { echo "ERRO: execute como root."; exit 1; }; }
f_simular() { case "$(printf '%s' "$FAROL_SIMULAR" | tr 'A-Z' 'a-z')" in 0|false|nao|não|n|no|falso) return 1;; *) return 0;; esac; }

f_root
d=$(f_num "$FAROL_DIAS" 30)
lista=$(find /var/log -type f \( -name '*.gz' -o -name '*.[0-9]' -o -name '*.old' -o -name '*.xz' -o -name '*.bz2' \) -mtime +"$d" 2>/dev/null)
n=$(printf '%s\n' "$lista" | grep -c .)
echo "$n arquivo(s) de log rotacionado(s) com mais de $d dias."
printf '%s\n' "$lista" | head -15
if f_simular; then echo "SIMULAÇÃO: nada removido."; else printf '%s\n' "$lista" | grep . | xargs -r rm -f; echo "Removidos."; fi
exit 0
