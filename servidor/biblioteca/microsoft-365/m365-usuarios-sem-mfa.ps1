# ---
# id: m365-usuarios-sem-mfa
# nome: "Microsoft 365 - usuários sem MFA registrado"
# descricao: "Usa o Microsoft Graph para listar usuários habilitados sem método de autenticação forte registrado. Exige login interativo ou credenciais de app."
# categoria: Microsoft 365
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 600
# requer_admin: false
# tags: [m365, mfa, graph]
# variaveis:
#   - nome: TENANT_ID
#     rotulo: "ID do tenant (app-only, opcional)"
#     tipo: texto
#     padrao: ""
#     obrigatorio: false
#     opcoes: []
#   - nome: CLIENT_ID
#     rotulo: "ID do aplicativo (opcional)"
#     tipo: texto
#     padrao: ""
#     obrigatorio: false
#     opcoes: []
#   - nome: CLIENT_SECRET
#     rotulo: "Segredo do aplicativo (opcional)"
#     tipo: senha
#     padrao: ""
#     obrigatorio: false
#     opcoes: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

if (-not (Get-Module -ListAvailable Microsoft.Graph.Reports)) { Write-Output "Módulo Microsoft.Graph não instalado. Use o script 'Microsoft 365 - instalar módulos PowerShell'."; exit 1 }
Import-Module Microsoft.Graph.Reports
if ($env:FAROL_TENANT_ID -and $env:FAROL_CLIENT_ID -and $env:FAROL_CLIENT_SECRET) {
  $sec = ConvertTo-SecureString $env:FAROL_CLIENT_SECRET -AsPlainText -Force
  Connect-MgGraph -TenantId $env:FAROL_TENANT_ID -ClientSecretCredential (New-Object PSCredential($env:FAROL_CLIENT_ID, $sec)) -NoWelcome
} else { Write-Output "Sem credenciais de aplicativo: usando login interativo (não funciona em execução remota sem sessão)."; Connect-MgGraph -Scopes 'AuditLog.Read.All', 'UserAuthenticationMethod.Read.All' -NoWelcome }
$r = Get-MgReportAuthenticationMethodUserRegistrationDetail -All | Where-Object { -not $_.IsMfaRegistered }
Write-Output ("Usuários sem MFA: {0}" -f @($r).Count)
$r | Select-Object UserPrincipalName, UserDisplayName, IsAdmin | Format-Table -AutoSize | Out-String | Write-Output
Disconnect-MgGraph | Out-Null
exit 0
