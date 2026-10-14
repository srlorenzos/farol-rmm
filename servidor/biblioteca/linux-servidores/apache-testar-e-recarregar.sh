#!/usr/bin/env bash
# ---
# id: apache-testar-e-recarregar
# nome: "Apache - testar configuração e recarregar"
# descricao: "Executa apachectl configtest e recarrega o Apache/httpd se válido e confirmado."
# categoria: Servidores Linux
# so: [linux]
# shell: bash
# tipo: acao
# tempo_limite: 60
# requer_admin: true
# tags: [apache, web]
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
if command -v apache2ctl >/dev/null 2>&1; then ctl=apache2ctl; svc=apache2; elif command -v apachectl >/dev/null 2>&1; then ctl=apachectl; svc=httpd; else echo "Apache não instalado."; exit 1; fi
$ctl configtest 2>&1 || { echo "Configuração INVÁLIDA."; exit 1; }
if ! f_confirmar; then echo "Válida. Defina CONFIRMAR=true para recarregar."; exit 0; fi
systemctl reload "$svc" && echo "$svc recarregado."
exit 0
