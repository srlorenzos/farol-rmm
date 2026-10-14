# ---
# id: m365-delegacoes-caixa
# nome: "Exchange Online - permissões em uma caixa"
# descricao: "Lista permissões Full Access, Send As e Send on Behalf em uma caixa de correio ou compartilhada."
# categoria: Microsoft 365
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 120
# requer_admin: false
# tags: [exchange, permissoes]
# variaveis:
#   - nome: USUARIO_ADMIN
#     rotulo: "UPN do administrador"
#     tipo: texto
#     padrao: ""
#     obrigatorio: true
#     opcoes: []
#   - nome: CAIXA
#     rotulo: "Caixa de correio (e-mail)"
#     tipo: texto
#     padrao: ""
#     obrigatorio: true
#     opcoes: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

if (-not (Get-Module -ListAvailable ExchangeOnlineManagement)) { Write-Output "Módulo ExchangeOnlineManagement não instalado."; exit 1 }
Import-Module ExchangeOnlineManagement
if ($env:FAROL_CAIXA -notmatch '^[^\s@]+@[^\s@]+$') { Write-Output "E-mail inválido."; exit 1 }
Connect-ExchangeOnline -UserPrincipalName $env:FAROL_USUARIO_ADMIN -ShowBanner:$false
Write-Output "== Full Access =="
Get-MailboxPermission -Identity $env:FAROL_CAIXA | Where-Object { -not $_.IsInherited -and $_.User -notlike 'NT AUTHORITY*' } | Select-Object User, AccessRights | Format-Table -AutoSize | Out-String | Write-Output
Write-Output "== Send As =="
Get-RecipientPermission -Identity $env:FAROL_CAIXA | Where-Object { $_.Trustee -ne 'NT AUTHORITY\SELF' } | Select-Object Trustee, AccessRights | Format-Table -AutoSize | Out-String | Write-Output
Write-Output "== Send on Behalf =="
(Get-Mailbox -Identity $env:FAROL_CAIXA).GrantSendOnBehalfTo
Disconnect-ExchangeOnline -Confirm:$false
exit 0
