#!/usr/bin/env bash
# ---
# id: linux-backup-tar-rotacao
# nome: "Linux - backup tar.gz com rotação"
# descricao: "Cria um tar.gz datado de um diretório e mantém apenas os N mais recentes no destino."
# categoria: Backup e recuperação
# so: [linux]
# shell: bash
# tipo: acao
# tempo_limite: 7200
# requer_admin: true
# tags: [tar, backup, rotacao]
# variaveis:
#   - nome: ORIGEM
#     rotulo: "Diretório de origem"
#     tipo: texto
#     padrao: ""
#     obrigatorio: true
#     opcoes: []
#   - nome: DESTINO
#     rotulo: "Pasta de destino"
#     tipo: texto
#     padrao: "/var/backups/farol"
#     obrigatorio: false
#     opcoes: []
#   - nome: MANTER
#     rotulo: "Quantidade a manter"
#     tipo: numero
#     padrao: 7
#     obrigatorio: false
#     opcoes: []
# ---
f_num() { case "$1" in ''|*[!0-9]*) echo "$2";; *) echo "$1";; esac; }

o="$FAROL_ORIGEM"; d="${FAROL_DESTINO:-/var/backups/farol}"; k=$(f_num "$FAROL_MANTER" 7)
[ -d "$o" ] || { echo "Origem inexistente."; exit 1; }
printf '%s' "$d" | grep -Eq '^/[A-Za-z0-9._/ -]+$' || { echo "Destino inválido."; exit 1; }
mkdir -p "$d"; nome=$(basename "$o" | tr -c 'A-Za-z0-9._-\n' '_')
arq="$d/$nome-$(date +%Y%m%d-%H%M).tar.gz"
tar -czf "$arq" -C "$(dirname "$o")" "$(basename "$o")" || exit 1
echo "Criado: $arq ($(du -h "$arq" | cut -f1))"
ls -1t "$d"/"$nome"-*.tar.gz 2>/dev/null | tail -n +$((k+1)) | while read -r v; do rm -f "$v" && echo "Rotação: removido $(basename "$v")"; done
exit 0
