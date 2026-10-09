#!/usr/bin/env bash
# ---
# id: linux-luks-backup-cabecalho
# nome: "Linux - backup do cabeçalho LUKS"
# descricao: "Exporta o cabeçalho LUKS de um dispositivo para arquivo (essencial para recuperação). Guarde o arquivo em local seguro."
# categoria: BitLocker e criptografia
# so: [linux]
# shell: bash
# tipo: acao
# tempo_limite: 120
# requer_admin: true
# tags: [luks, backup]
# variaveis:
#   - nome: DISPOSITIVO
#     rotulo: "Dispositivo (ex.: /dev/sda3)"
#     tipo: texto
#     padrao: ""
#     obrigatorio: true
#     opcoes: []
#   - nome: DESTINO
#     rotulo: "Pasta de destino"
#     tipo: texto
#     padrao: "/root"
#     obrigatorio: false
#     opcoes: []
# ---
f_root() { [ "$(id -u)" -eq 0 ] || { echo "ERRO: execute como root."; exit 1; }; }

f_root
d="$FAROL_DISPOSITIVO"; printf '%s' "$d" | grep -Eq '^/dev/[A-Za-z0-9/_-]+$' || { echo "Dispositivo inválido."; exit 1; }
cryptsetup isLuks "$d" 2>/dev/null || { echo "$d não é LUKS."; exit 1; }
o="${FAROL_DESTINO:-/root}/luks-header-$(basename "$d")-$(date +%Y%m%d).img"
rm -f "$o"; cryptsetup luksHeaderBackup "$d" --header-backup-file "$o" && chmod 600 "$o" && echo "Cabeçalho salvo em $o"
exit 0
