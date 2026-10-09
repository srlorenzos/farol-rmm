# ---
# id: rdp-status
# nome: "Status do RDP e NLA"
# descricao: "Informa se o RDP está habilitado, porta, NLA, regra de firewall e usuários autorizados."
# categoria: Acesso remoto
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 120
# requer_admin: false
# tags: [rdp]
# variaveis: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

$ts = Get-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Control\Terminal Server'
$wp = Get-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Control\Terminal Server\WinStations\RDP-Tcp'
Write-Output ("RDP habilitado: {0}" -f $(if ($ts.fDenyTSConnections -eq 0) { 'sim' } else { 'não' }))
Write-Output ("Porta: {0}`nNLA exigida: {1}`nCamada de segurança: {2}" -f $wp.PortNumber, $(if ($wp.UserAuthentication -eq 1) { 'sim' } else { 'NÃO' }), $wp.SecurityLayer)
Write-Output ("Regras de firewall RDP ativas: {0}" -f @(Get-NetFirewallRule -DisplayGroup 'Área de Trabalho Remota', 'Remote Desktop' -ErrorAction SilentlyContinue | Where-Object { $_.Enabled -eq 'True' }).Count)
Write-Output "Membros de Usuários da Área de Trabalho Remota:"
Get-LocalGroupMember -SID 'S-1-5-32-555' -ErrorAction SilentlyContinue | ForEach-Object { " - $($_.Name)" }
exit 0
