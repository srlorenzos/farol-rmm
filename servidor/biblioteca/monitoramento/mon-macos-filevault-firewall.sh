#!/usr/bin/env bash
# ---
# id: mon-macos-filevault-firewall
# nome: "Monitor - FileVault e firewall no macOS"
# descricao: "Verifica se o FileVault está ativo e o firewall de aplicativo ligado."
# categoria: Monitoramento
# so: [macos]
# shell: bash
# tipo: monitor
# tempo_limite: 60
# requer_admin: false
# tags: [filevault, firewall, monitor]
# variaveis: []
# ---
f_status() { echo "FAROL_STATUS: $1 $2"; }

fv=$(fdesetup status 2>&1 | head -1); fw=$(/usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate 2>&1)
p=""
echo "$fv" | grep -qi 'is On' || p="$p FileVault desligado;"
echo "$fw" | grep -qi 'enabled' || p="$p Firewall desligado;"
if [ -n "$p" ]; then f_status alerta "$p"; else f_status ok "FileVault ativo e firewall ligado"; fi
exit 0
