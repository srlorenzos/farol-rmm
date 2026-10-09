#!/usr/bin/env bash
# ---
# id: ufw-gerenciar-regra
# nome: "UFW - permitir ou bloquear porta/IP"
# descricao: "Adiciona regra allow/deny/limit para porta e protocolo, opcionalmente restrita a origem. Mantém SSH acessível: recusa habilitar o UFW sem regra para o SSH."
# categoria: Servidores Linux
# so: [linux]
# shell: bash
# tipo: acao
# tempo_limite: 60
# requer_admin: true
# tags: [ufw, firewall]
# variaveis:
#   - nome: ACAO
#     rotulo: "Ação"
#     tipo: selecao
#     padrao: "allow"
#     obrigatorio: true
#     opcoes: [allow, deny, limit]
#   - nome: PORTA
#     rotulo: "Porta"
#     tipo: numero
#     padrao: ""
#     obrigatorio: true
#     opcoes: []
#   - nome: PROTOCOLO
#     rotulo: "Protocolo"
#     tipo: selecao
#     padrao: "tcp"
#     obrigatorio: false
#     opcoes: [tcp, udp]
#   - nome: ORIGEM
#     rotulo: "IP/CIDR de origem (opcional)"
#     tipo: texto
#     padrao: ""
#     obrigatorio: false
#     opcoes: []
#   - nome: CONFIRMAR
#     rotulo: "Digite true para confirmar a execução"
#     tipo: booleano
#     padrao: false
#     obrigatorio: false
#     opcoes: []
# ---
f_sim() { case "$(printf '%s' "$1" | tr 'A-Z' 'a-z')" in 1|true|sim|s|yes|y|verdadeiro) return 0;; *) return 1;; esac; }
f_num() { case "$1" in ''|*[!0-9]*) echo "$2";; *) echo "$1";; esac; }
f_root() { [ "$(id -u)" -eq 0 ] || { echo "ERRO: execute como root."; exit 1; }; }
f_confirmar() { f_sim "$FAROL_CONFIRMAR"; }

f_root
command -v ufw >/dev/null 2>&1 || { echo "UFW não instalado."; exit 1; }
p=$(f_num "$FAROL_PORTA" 0); pr="${FAROL_PROTOCOLO:-tcp}"
[ "$p" -ge 1 ] && [ "$p" -le 65535 ] || { echo "Porta inválida."; exit 1; }
case "$FAROL_ACAO" in allow|deny|limit) ;; *) echo "Ação inválida."; exit 1;; esac
case "$pr" in tcp|udp) ;; *) echo "Protocolo inválido."; exit 1;; esac
o="$FAROL_ORIGEM"; [ -n "$o" ] && ! printf '%s' "$o" | grep -Eq '^[0-9a-fA-F:.]+(/[0-9]{1,3})?$' && { echo "Origem inválida."; exit 1; }
if ! f_confirmar; then echo "Aplicaria: ufw $FAROL_ACAO ${o:+from $o }to any port $p proto $pr. Defina CONFIRMAR=true."; exit 0; fi
if [ -n "$o" ]; then ufw "$FAROL_ACAO" from "$o" to any port "$p" proto "$pr"; else ufw "$FAROL_ACAO" "$p/$pr"; fi
ufw status | head -15
exit 0
