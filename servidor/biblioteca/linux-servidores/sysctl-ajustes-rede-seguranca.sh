#!/usr/bin/env bash
# ---
# id: sysctl-ajustes-rede-seguranca
# nome: "sysctl - ajustes de segurança de rede (hardening)"
# descricao: "Aplica parâmetros de kernel recomendados (rp_filter, syncookies, redirects off, ICMP) via /etc/sysctl.d. Mostra valores atuais antes."
# categoria: Servidores Linux
# so: [linux]
# shell: bash
# tipo: acao
# tempo_limite: 60
# requer_admin: true
# tags: [sysctl, hardening]
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
for k in net.ipv4.tcp_syncookies net.ipv4.conf.all.rp_filter net.ipv4.conf.all.accept_redirects net.ipv4.conf.all.send_redirects net.ipv4.icmp_echo_ignore_broadcasts net.ipv4.conf.all.accept_source_route kernel.kptr_restrict kernel.dmesg_restrict; do printf '%-45s %s\n' "$k" "$(sysctl -n $k 2>/dev/null)"; done
if ! f_confirmar; then echo "Defina CONFIRMAR=true para aplicar /etc/sysctl.d/99-farol-hardening.conf."; exit 0; fi
cat > /etc/sysctl.d/99-farol-hardening.conf <<'EOF'
net.ipv4.tcp_syncookies = 1
net.ipv4.conf.all.rp_filter = 1
net.ipv4.conf.default.rp_filter = 1
net.ipv4.conf.all.accept_redirects = 0
net.ipv4.conf.default.accept_redirects = 0
net.ipv4.conf.all.send_redirects = 0
net.ipv4.icmp_echo_ignore_broadcasts = 1
net.ipv4.conf.all.accept_source_route = 0
kernel.kptr_restrict = 2
kernel.dmesg_restrict = 1
EOF
sysctl --system >/dev/null && echo "Parâmetros aplicados."
exit 0
