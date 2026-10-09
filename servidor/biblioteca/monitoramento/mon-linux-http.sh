#!/usr/bin/env bash
# ---
# id: mon-linux-http
# nome: "Monitor - URL HTTP/HTTPS"
# descricao: "Faz requisição com curl e valida código HTTP, tempo de resposta e texto opcional."
# categoria: Monitoramento
# so: [linux]
# shell: bash
# tipo: monitor
# tempo_limite: 60
# requer_admin: false
# tags: [http, web, monitor]
# variaveis:
#   - nome: URL
#     rotulo: "URL"
#     tipo: texto
#     padrao: ""
#     obrigatorio: true
#     opcoes: []
#   - nome: TEXTO
#     rotulo: "Texto esperado (opcional)"
#     tipo: texto
#     padrao: ""
#     obrigatorio: false
#     opcoes: []
#   - nome: ALERTA_MS
#     rotulo: "Alerta (ms)"
#     tipo: numero
#     padrao: 2000
#     obrigatorio: false
#     opcoes: []
# ---
f_num() { case "$1" in ''|*[!0-9]*) echo "$2";; *) echo "$1";; esac; }
f_status() { echo "FAROL_STATUS: $1 $2"; }

u="$FAROL_URL"; a=$(f_num "$FAROL_ALERTA_MS" 2000)
printf '%s' "$u" | grep -Eq '^https?://[^[:space:]]+$' || { echo "URL inválida."; exit 2; }
command -v curl >/dev/null 2>&1 || { echo "curl ausente."; exit 1; }
tmp=$(mktemp); out=$(curl -s -o "$tmp" -m 20 -w '%{http_code} %{time_total}' "$u" 2>/dev/null); cod=${out%% *}; t=${out##* }
ms=$(awk -v t="$t" 'BEGIN {printf "%d", t*1000}')
if [ "$cod" -lt 200 ] 2>/dev/null && [ "$cod" = "000" ] || [ "$cod" -ge 400 ] 2>/dev/null; then rm -f "$tmp"; f_status critico "HTTP $cod em $u"; exit 0; fi
if [ -n "$FAROL_TEXTO" ] && ! grep -qF -- "$FAROL_TEXTO" "$tmp"; then rm -f "$tmp"; f_status critico "HTTP $cod mas texto esperado ausente"; exit 0; fi
rm -f "$tmp"
if [ "$ms" -ge "$a" ]; then f_status alerta "HTTP $cod em ${ms} ms"; else f_status ok "HTTP $cod em ${ms} ms"; fi
exit 0
