#!/usr/bin/env bash
# ---
# id: linux-cis-verificacao-basica
# nome: "Linux - CIS verificação básica"
# descricao: "Checa configurações centrais: SSH root/senha vazia, firewall ativo, ASLR, permissões de /etc/passwd e shadow, contas sem senha, UID 0 extras, pacotes de risco e atualizações automáticas."
# categoria: Compliance
# so: [linux]
# shell: bash
# tipo: auditoria
# tempo_limite: 120
# requer_admin: true
# tags: [cis, compliance, hardening]
# variaveis: []
# ---

p=0; f=0
t() { if eval "$2" >/dev/null 2>&1; then echo "[PASSOU] $1"; p=$((p+1)); else echo "[FALHOU] $1"; f=$((f+1)); fi; }
t "Login root por SSH desabilitado" "sshd -T 2>/dev/null | grep -qE '^permitrootlogin (no|prohibit-password|without-password)'"
t "Senhas vazias no SSH proibidas" "sshd -T 2>/dev/null | grep -q '^permitemptypasswords no'"
t "Firewall ativo (ufw/firewalld/nftables)" "ufw status 2>/dev/null | grep -q active || systemctl is-active --quiet firewalld || nft list ruleset 2>/dev/null | grep -q chain"
t "ASLR habilitado (randomize_va_space=2)" "[ \"\$(cat /proc/sys/kernel/randomize_va_space)\" = 2 ]"
t "/etc/shadow com permissão restrita" "[ \"\$(stat -c %a /etc/shadow)\" -le 640 ]"
t "/etc/passwd não gravável por outros" "[ \"\$(stat -c %a /etc/passwd)\" -le 644 ]"
t "Nenhuma conta sem senha" "[ -z \"\$(awk -F: '\$2==\"\" {print \$1}' /etc/shadow)\" ]"
t "Apenas root com UID 0" "[ \"\$(awk -F: '\$3==0' /etc/passwd | wc -l)\" = 1 ]"
t "telnet/rsh/tftp ausentes" "! (command -v telnetd || command -v in.rshd || command -v in.tftpd)"
t "Atualizações automáticas configuradas" "[ -f /etc/apt/apt.conf.d/20auto-upgrades ] || systemctl is-enabled dnf-automatic.timer"
t "IP forwarding desligado (ou roteador)" "[ \"\$(sysctl -n net.ipv4.ip_forward)\" = 0 ]"
echo "Resultado: $p aprovados, $f reprovados."
exit 0
