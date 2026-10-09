#!/usr/bin/env bash
# ---
# id: nginx-testar-e-recarregar
# nome: "nginx - testar configuração e recarregar"
# descricao: "Executa nginx -t e, se válido e confirmado, recarrega o serviço sem derrubar conexões."
# categoria: Servidores Linux
# so: [linux]
# shell: bash
# tipo: acao
# tempo_limite: 60
# requer_admin: true
# tags: [nginx, web]
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
command -v nginx >/dev/null 2>&1 || { echo "nginx não instalado."; exit 1; }
nginx -t 2>&1 || { echo "Configuração INVÁLIDA; nada foi recarregado."; exit 1; }
if ! f_confirmar; then echo "Configuração válida. Defina CONFIRMAR=true para recarregar."; exit 0; fi
systemctl reload nginx && echo "nginx recarregado."
exit 0
