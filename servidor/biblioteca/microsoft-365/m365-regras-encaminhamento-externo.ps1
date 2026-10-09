# ---
# id: m365-regras-encaminhamento-externo
# nome: "Exchange Online - encaminhamento externo"
# descricao: "Detecta caixas com encaminhamento SMTP para fora e regras de inbox que redirecionam e-mail — indicador comum de comprometimento."
# categoria: Microsoft 365
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 900
# requer_admin: false
# tags: [exchange, seguranca, encaminhamento]
# variaveis:
#   - nome: USUARIO_ADMIN
#     rotulo: "UPN do administrador"
#     tipo: texto
#     padrao: ""
#     obrigatorio: true
#     opcoes: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

if (-not (Get-Module -ListAvailable ExchangeOnlineManagement)) { Write-Output "Módulo ExchangeOnlineManagement não instalado."; exit 1 }
Import-Module ExchangeOnlineManagement
Connect-ExchangeOnline -UserPrincipalName $env:FAROL_USUARIO_ADMIN -ShowBanner:$false
Write-Output "== Encaminhamento no nível da caixa =="
Get-Mailbox -ResultSize Unlimited | Where-Object { $_.ForwardingSmtpAddress -or $_.ForwardingAddress } | Select-Object UserPrincipalName, ForwardingSmtpAddress, ForwardingAddress, DeliverToMailboxAndForward | Format-Table -AutoSize | Out-String | Write-Output
Write-Output "== Regras de caixa de entrada com redirecionamento =="
Get-Mailbox -ResultSize Unlimited | ForEach-Object { $u = $_.UserPrincipalName; Get-InboxRule -Mailbox $u -ErrorAction SilentlyContinue | Where-Object { $_.ForwardTo -or $_.RedirectTo -or $_.ForwardAsAttachmentTo } | ForEach-Object { [pscustomobject]@{ Usuario = $u; Regra = $_.Name; Para = (@($_.ForwardTo) + @($_.RedirectTo) + @($_.ForwardAsAttachmentTo)) -join '; ' } } } | Format-Table -AutoSize | Out-String | Write-Output
Disconnect-ExchangeOnline -Confirm:$false
exit 0
