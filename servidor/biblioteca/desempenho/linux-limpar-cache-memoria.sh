#!/usr/bin/env bash
# ---
# id: linux-limpar-cache-memoria
# nome: "Linux - liberar page cache"
# descricao: "Sincroniza o disco e libera o page cache/dentries (drop_caches). Uso diagnóstico; o kernel recria o cache sob demanda."
# categoria: Desempenho
# so: [linux]
# shell: bash
# tipo: acao
# tempo_limite: 60
# requer_admin: true
# tags: [cache, memoria]
# variaveis:
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
free -h | head -2
if ! f_confirmar; then echo "Defina CONFIRMAR=true para liberar o cache."; exit 0; fi
sync; echo 3 > /proc/sys/vm/drop_caches
free -h | head -2
exit 0
