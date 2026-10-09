#!/usr/bin/env bash
# ---
# id: linux-luks-status-discos
# nome: "Linux - status da criptografia LUKS"
# descricao: "Lista volumes criptografados (LUKS), cabeçalhos e dispositivos abertos."
# categoria: BitLocker e criptografia
# so: [linux]
# shell: bash
# tipo: auditoria
# tempo_limite: 120
# requer_admin: true
# tags: [luks, criptografia]
# variaveis: []
# ---

lsblk -o NAME,TYPE,FSTYPE,SIZE,MOUNTPOINT 2>/dev/null | grep -E 'crypt|NAME'
for d in $(lsblk -lnpo NAME,FSTYPE | awk '$2=="crypto_LUKS" {print $1}'); do echo "=== $d"; cryptsetup luksDump "$d" 2>/dev/null | grep -E 'Version|Cipher|Key Slot|Keyslots|PBKDF' | head -8; done
[ -z "$(lsblk -lnpo FSTYPE | grep crypto_LUKS)" ] && echo "Nenhum volume LUKS encontrado."
exit 0
