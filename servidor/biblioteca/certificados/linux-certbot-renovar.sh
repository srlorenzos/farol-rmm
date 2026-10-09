#!/usr/bin/env bash
# ---
# id: linux-certbot-renovar
# nome: "Linux - renovar certificados com certbot"
# descricao: "Executa certbot renew (dry-run por padrão) e recarrega nginx/Apache quando a renovação ocorre."
# categoria: Certificados
# so: [linux]
# shell: bash
# tipo: acao
# tempo_limite: 600
# requer_admin: true
# tags: [certbot, letsencrypt]
# variaveis:
#   - nome: SIMULAR
#     rotulo: "Modo simulação (não altera nada; use false para aplicar)"
#     tipo: booleano
#     padrao: true
#     obrigatorio: false
#     opcoes: []
# ---
f_root() { [ "$(id -u)" -eq 0 ] || { echo "ERRO: execute como root."; exit 1; }; }
f_simular() { case "$(printf '%s' "$FAROL_SIMULAR" | tr 'A-Z' 'a-z')" in 0|false|nao|não|n|no|falso) return 1;; *) return 0;; esac; }

f_root
command -v certbot >/dev/null 2>&1 || { echo "certbot não instalado."; exit 1; }
if f_simular; then certbot renew --dry-run; exit $?; fi
certbot renew --deploy-hook 'systemctl reload nginx 2>/dev/null || systemctl reload apache2 2>/dev/null || systemctl reload httpd 2>/dev/null || true'
exit $?
