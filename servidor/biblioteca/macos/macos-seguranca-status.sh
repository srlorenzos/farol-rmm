#!/usr/bin/env bash
# ---
# id: macos-seguranca-status
# nome: "macOS - status de segurança (FileVault, Gatekeeper, SIP, firewall)"
# descricao: "Verifica FileVault, Gatekeeper, SIP, firewall de aplicativo, atualizações automáticas e login automático."
# categoria: macOS
# so: [macos]
# shell: bash
# tipo: auditoria
# tempo_limite: 120
# requer_admin: false
# tags: [seguranca, filevault, sip]
# variaveis: []
# ---

echo "FileVault: $(fdesetup status 2>/dev/null | head -1)"
echo "Gatekeeper: $(spctl --status 2>&1)"
echo "SIP: $(csrutil status 2>&1)"
echo "Firewall: $(/usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate 2>&1)"
echo "Login automático: $(defaults read /Library/Preferences/com.apple.loginwindow autoLoginUser 2>/dev/null || echo desativado)"
echo "Atualização automática: $(defaults read /Library/Preferences/com.apple.SoftwareUpdate AutomaticCheckEnabled 2>/dev/null || echo n/d)"
exit 0
