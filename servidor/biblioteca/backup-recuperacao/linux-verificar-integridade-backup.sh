#!/usr/bin/env bash
# ---
# id: linux-verificar-integridade-backup
# nome: "Linux - verificar integridade de backups tar.gz"
# descricao: "Testa a integridade (gzip -t / tar -tzf) dos arquivos de backup mais recentes em uma pasta."
# categoria: Backup e recuperação
# so: [linux]
# shell: bash
# tipo: auditoria
# tempo_limite: 1800
# requer_admin: false
# tags: [backup, integridade]
# variaveis:
#   - nome: PASTA
#     rotulo: "Pasta dos backups"
#     tipo: texto
#     padrao: "/var/backups/farol"
#     obrigatorio: false
#     opcoes: []
#   - nome: QUANTIDADE
#     rotulo: "Quantidade de arquivos recentes"
#     tipo: numero
#     padrao: 3
#     obrigatorio: false
#     opcoes: []
# ---
f_num() { case "$1" in ''|*[!0-9]*) echo "$2";; *) echo "$1";; esac; }

p="${FAROL_PASTA:-/var/backups/farol}"; [ -d "$p" ] || { echo "Pasta inexistente."; exit 1; }
ls -1t "$p"/*.tar.gz "$p"/*.sql.gz "$p"/*.tgz 2>/dev/null | head -n "$(f_num "$FAROL_QUANTIDADE" 3)" | while read -r a; do
  if gzip -t "$a" 2>/dev/null; then echo "[OK]    $(basename "$a") ($(du -h "$a" | cut -f1))"; else echo "[CORROMPIDO] $(basename "$a")"; fi
done
exit 0
