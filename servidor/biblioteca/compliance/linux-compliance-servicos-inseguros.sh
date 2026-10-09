#!/usr/bin/env bash
# ---
# id: linux-compliance-servicos-inseguros
# nome: "Linux - serviços e protocolos inseguros"
# descricao: "Detecta telnet, rsh, FTP, SMBv1, NFS sem restrição, SNMP v1/v2 e portas legadas em escuta."
# categoria: Compliance
# so: [linux]
# shell: bash
# tipo: auditoria
# tempo_limite: 120
# requer_admin: true
# tags: [servicos, compliance]
# variaveis: []
# ---

ss -tulnH 2>/dev/null | awk '{print $5}' | grep -oE '[0-9]+$' | sort -un | while read -r p; do
  case "$p" in 21) echo "[RISCO] FTP (21) em escuta";; 23) echo "[RISCO] Telnet (23) em escuta";; 512|513|514) echo "[RISCO] r-services ($p)";; 69) echo "[RISCO] TFTP (69)";; 161) echo "[ATENÇÃO] SNMP (161)";; 2049) echo "[ATENÇÃO] NFS (2049)";; 445|139) echo "[ATENÇÃO] SMB ($p)";; 3306|5432|27017|6379) echo "[ATENÇÃO] Banco de dados ($p) escutando — confirme que não está exposto";; esac
done
grep -rE 'min protocol|ntlm auth' /etc/samba/smb.conf 2>/dev/null
echo "Verificação concluída."
exit 0
