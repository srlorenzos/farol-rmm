#!/usr/bin/env bash
# ---
# id: swap-criar-arquivo
# nome: "Criar arquivo de swap"
# descricao: "Cria e ativa um arquivo de swap persistente (fstab) quando não há swap suficiente. Idempotente."
# categoria: Servidores Linux
# so: [linux]
# shell: bash
# tipo: acao
# tempo_limite: 300
# requer_admin: true
# tags: [swap, memoria]
# variaveis:
#   - nome: TAMANHO_MB
#     rotulo: "Tamanho (MB)"
#     tipo: numero
#     padrao: 2048
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
mb=$(f_num "$FAROL_TAMANHO_MB" 2048); swapon --show
if [ -f /swapfile ]; then echo "/swapfile já existe."; exit 0; fi
if ! f_confirmar; then echo "Criaria /swapfile de ${mb} MB. Defina CONFIRMAR=true."; exit 0; fi
livre=$(df -Pm / | awk 'NR==2 {print $4}'); [ "$livre" -gt $((mb + 1024)) ] || { echo "Espaço insuficiente."; exit 1; }
fallocate -l "${mb}M" /swapfile 2>/dev/null || dd if=/dev/zero of=/swapfile bs=1M count="$mb" status=none
chmod 600 /swapfile; mkswap /swapfile >/dev/null; swapon /swapfile
grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
swapon --show
exit 0
