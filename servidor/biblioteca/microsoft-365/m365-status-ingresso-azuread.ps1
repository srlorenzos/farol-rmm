# ---
# id: m365-status-ingresso-azuread
# nome: "Entra ID - status de ingresso do dispositivo"
# descricao: "Mostra se o computador está ingressado no Microsoft Entra ID (Azure AD), híbrido ou apenas registrado, e o estado do PRT (dsregcmd)."
# categoria: Microsoft 365
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 120
# requer_admin: false
# tags: [entra, azuread, dsregcmd]
# variaveis: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

$o = dsregcmd /status | Out-String
$o -split "`n" | Where-Object { $_ -match 'AzureAdJoined|EnterpriseJoined|DomainJoined|DeviceName|TenantName|TenantId|AzureAdPrt|WorkplaceJoined|MdmUrl' } | ForEach-Object { $_.Trim() } | Write-Output
exit 0
