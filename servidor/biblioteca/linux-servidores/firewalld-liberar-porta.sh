#!/usr/bin/env bash
# ---
# id: firewalld-liberar-porta
# nome: "firewalld - liberar ou fechar porta"
# descricao: "Adiciona ou remove uma porta/serviço permanentemente na zona padrão e recarrega."
# categoria: Servidores Linux
# so: [linux]
# shell: bash
# tipo: acao
# tempo_limite: 60
# requer_admin: true
# tags: [firewalld, firewall]
# variaveis:
#   - nome: PORTA
#     rotulo: "Porta/protocolo (ex.: 8080/tcp)"
#     tipo: texto
#     padrao: ""
#     obrigatorio: true
#     opcoes: []
#   - nome: ACAO
#     rotulo: "Ação"
#     tipo: selecao
#     padrao: "abrir"
#     obrigatorio: true
#     opcoes: [abrir, fechar]
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
command -v firewall-cmd >/dev/null 2>&1 || { echo "firewalld não instalado."; exit 1; }
p="$FAROL_PORTA"; printf '%s' "$p" | grep -Eq '^[0-9]{1,5}(-[0-9]{1,5})?/(tcp|udp)$' || { echo "Formato inválido (use 8080/tcp)."; exit 1; }
if ! f_confirmar; then echo "Aplicaria: $FAROL_ACAO $p. Defina CONFIRMAR=true."; exit 0; fi
if [ "$FAROL_ACAO" = "fechar" ]; then firewall-cmd --permanent --remove-port="$p"; else firewall-cmd --permanent --add-port="$p"; fi
firewall-cmd --reload
firewall-cmd --list-ports
exit 0
