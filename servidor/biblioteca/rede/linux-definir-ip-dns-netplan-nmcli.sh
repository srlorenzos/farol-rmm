#!/usr/bin/env bash
# ---
# id: linux-definir-ip-dns-netplan-nmcli
# nome: "Linux - configurar DNS por NetworkManager"
# descricao: "Define servidores DNS em uma conexão do NetworkManager (nmcli) e reativa a conexão. Mostra o estado atual antes de alterar."
# categoria: Rede
# so: [linux]
# shell: bash
# tipo: acao
# tempo_limite: 120
# requer_admin: true
# tags: [dns, nmcli]
# variaveis:
#   - nome: CONEXAO
#     rotulo: "Nome da conexão (nmcli con show)"
#     tipo: texto
#     padrao: ""
#     obrigatorio: true
#     opcoes: []
#   - nome: DNS
#     rotulo: "Servidores DNS separados por espaço"
#     tipo: texto
#     padrao: "1.1.1.1 8.8.8.8"
#     obrigatorio: true
#     opcoes: []
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
command -v nmcli >/dev/null 2>&1 || { echo "NetworkManager (nmcli) não disponível."; exit 1; }
c="$FAROL_CONEXAO"; d="$FAROL_DNS"
printf '%s' "$c" | grep -Eq '^[A-Za-z0-9 ._-]+$' || { echo "Nome de conexão inválido."; exit 1; }
for ip in $d; do printf '%s' "$ip" | grep -Eq '^[0-9a-fA-F:.]+$' || { echo "DNS inválido: $ip"; exit 1; }; done
nmcli -g ipv4.dns con show "$c" || exit 1
if ! f_confirmar; then echo "Defina CONFIRMAR=true para aplicar DNS '$d' em '$c'."; exit 0; fi
nmcli con mod "$c" ipv4.dns "$d" ipv4.ignore-auto-dns yes && nmcli con up "$c"
exit 0
