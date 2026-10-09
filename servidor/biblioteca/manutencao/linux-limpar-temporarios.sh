#!/usr/bin/env bash
# ---
# id: linux-limpar-temporarios
# nome: "Linux - limpar arquivos temporários antigos"
# descricao: "Remove arquivos de /tmp e /var/tmp não acessados há N dias, sem tocar em sockets e arquivos em uso. Simulação por padrão."
# categoria: Manutenção
# so: [linux]
# shell: bash
# tipo: acao
# tempo_limite: 600
# requer_admin: true
# tags: [limpeza, tmp]
# variaveis:
#   - nome: DIAS
#     rotulo: "Não acessados há (dias)"
#     tipo: numero
#     padrao: 7
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
d=$(f_num "$FAROL_DIAS" 7)
for dir in /tmp /var/tmp; do
  n=$(find "$dir" -xdev -type f -atime +"$d" 2>/dev/null | wc -l)
  tam=$(find "$dir" -xdev -type f -atime +"$d" -printf '%s\n' 2>/dev/null | awk '{s+=$1} END {printf "%.1f MB", s/1048576}')
  echo "$dir: $n arquivo(s), $tam"
  f_simular || find "$dir" -xdev -type f -atime +"$d" -delete 2>/dev/null
done
f_simular && echo "SIMULAÇÃO: nada removido."
exit 0
