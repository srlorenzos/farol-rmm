#!/usr/bin/env bash
# ---
# id: linux-certificados-listar-letsencrypt
# nome: "Linux - certificados Let's Encrypt e locais"
# descricao: "Lista certificados em /etc/letsencrypt/live e /etc/ssl com validade e dias restantes; mostra certbot certificates quando disponível."
# categoria: Certificados
# so: [linux]
# shell: bash
# tipo: auditoria
# tempo_limite: 120
# requer_admin: true
# tags: [certificados, letsencrypt]
# variaveis: []
# ---

for c in /etc/letsencrypt/live/*/cert.pem /etc/ssl/certs/*.crt /etc/pki/tls/certs/*.crt; do
  [ -f "$c" ] || continue; fim=$(openssl x509 -in "$c" -noout -enddate 2>/dev/null | cut -d= -f2); [ -n "$fim" ] || continue
  d=$(( ( $(date -d "$fim" +%s) - $(date +%s) ) / 86400 )); printf '%6s dias  %s  (%s)\n' "$d" "$c" "$(openssl x509 -in "$c" -noout -subject 2>/dev/null | cut -c1-60)"
done | sort -n | head -40
command -v certbot >/dev/null 2>&1 && certbot certificates 2>/dev/null | head -30
exit 0
