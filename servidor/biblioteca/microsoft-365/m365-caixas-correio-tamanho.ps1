# ---
# id: m365-caixas-correio-tamanho
# nome: "Exchange Online - caixas de correio por tamanho"
# descricao: "Lista as maiores caixas de correio e o percentual de uso da cota via Exchange Online PowerShell."
# categoria: Microsoft 365
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 900
# requer_admin: false
# tags: [exchange, caixas, cota]
# variaveis:
#   - nome: USUARIO_ADMIN
#     rotulo: "UPN do administrador"
#     tipo: texto
#     padrao: ""
#     obrigatorio: true
#     opcoes: []
#   - nome: TOP
#     rotulo: "Quantidade"
#     tipo: numero
#     padrao: 20
#     obrigatorio: false
#     opcoes: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function Get-Num($v, $padrao) { if ("$v" -match '^\d+$') { [int]$v } else { $padrao } }

if (-not (Get-Module -ListAvailable ExchangeOnlineManagement)) { Write-Output "Módulo ExchangeOnlineManagement não instalado. Use o script de instalação dos módulos."; exit 1 }
Import-Module ExchangeOnlineManagement
Connect-ExchangeOnline -UserPrincipalName $env:FAROL_USUARIO_ADMIN -ShowBanner:$false
$top = Get-Num $env:FAROL_TOP 20
Get-EXOMailbox -ResultSize Unlimited -Properties ProhibitSendQuota | ForEach-Object {
  $s = Get-EXOMailboxStatistics -Identity $_.UserPrincipalName -ErrorAction SilentlyContinue
  if ($s) { [pscustomobject]@{ Usuario = $_.UserPrincipalName; Itens = $s.ItemCount; Tamanho = "$($s.TotalItemSize.Value)"; Bytes = $s.TotalItemSize.Value.ToBytes() } }
} | Sort-Object Bytes -Descending | Select-Object -First $top Usuario, Itens, Tamanho | Format-Table -AutoSize | Out-String | Write-Output
Disconnect-ExchangeOnline -Confirm:$false
exit 0
