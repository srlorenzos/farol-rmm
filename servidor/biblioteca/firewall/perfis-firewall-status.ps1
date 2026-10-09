# ---
# id: perfis-firewall-status
# nome: "Status dos perfis do firewall"
# descricao: "Mostra se o Firewall do Windows está ativo em cada perfil, ações padrão e log."
# categoria: Firewall
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 120
# requer_admin: false
# tags: [firewall]
# variaveis: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

Get-NetFirewallProfile | Select-Object Name, Enabled, DefaultInboundAction, DefaultOutboundAction, LogAllowed, LogBlocked, LogFileName | Format-Table -AutoSize | Out-String -Width 200 | Write-Output
exit 0
