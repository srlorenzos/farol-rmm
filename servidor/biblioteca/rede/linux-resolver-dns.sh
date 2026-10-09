#!/usr/bin/env bash
# ---
# id: linux-resolver-dns
# nome: "Linux - diagnóstico de DNS"
# descricao: "Resolve um nome por A, AAAA, MX e TXT usando dig/host/getent, comparando com um servidor alternativo."
# categoria: Rede
# so: [linux]
# shell: bash
# tipo: auditoria
# tempo_limite: 120
# requer_admin: false
# tags: [dns]
# variaveis:
#   - nome: NOME
#     rotulo: "Nome"
#     tipo: texto
#     padrao: "google.com"
#     obrigatorio: true
#     opcoes: []
#   - nome: SERVIDOR
#     rotulo: "Servidor DNS alternativo"
#     tipo: texto
#     padrao: "1.1.1.1"
#     obrigatorio: false
#     opcoes: []
# ---

n="$FAROL_NOME"; printf '%s' "$n" | grep -Eq '^[A-Za-z0-9._-]+$' || { echo "Nome inválido."; exit 1; }
s="$FAROL_SERVIDOR"; [ -n "$s" ] && ! printf '%s' "$s" | grep -Eq '^[0-9a-fA-F:.]+$' && { echo "Servidor inválido."; exit 1; }
if command -v dig >/dev/null 2>&1; then for t in A AAAA MX TXT; do echo "== $t"; dig +short "$n" "$t"; done; [ -n "$s" ] && { echo "== A via $s"; dig +short "$n" A "@$s"; }
else echo "== getent"; getent hosts "$n"; fi
exit 0
