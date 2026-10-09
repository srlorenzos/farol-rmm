#!/usr/bin/env bash
# ---
# id: linux-seguranca-chaves-ssh-host-e-algoritmos
# nome: "Linux - algoritmos e tamanhos de chaves de host SSH"
# descricao: "Mostra fingerprints e tipos das chaves de host e alerta chaves DSA/RSA curtas."
# categoria: Segurança
# so: [linux]
# shell: bash
# tipo: auditoria
# tempo_limite: 120
# requer_admin: true
# tags: [ssh, criptografia]
# variaveis: []
# ---

for k in /etc/ssh/ssh_host_*_key.pub; do [ -f "$k" ] && ssh-keygen -lf "$k"; done
ssh-keygen -lf /etc/ssh/ssh_host_rsa_key.pub 2>/dev/null | awk '$1 < 3072 {print "[ATENÇÃO] RSA com menos de 3072 bits"}'
[ -f /etc/ssh/ssh_host_dsa_key.pub ] && echo "[FALHOU] Chave DSA presente (obsoleta)"
sshd -T 2>/dev/null | grep -E '^(ciphers|macs|kexalgorithms)' | cut -c1-160
exit 0
