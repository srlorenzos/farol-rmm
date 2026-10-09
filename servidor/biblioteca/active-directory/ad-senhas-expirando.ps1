# ---
# id: ad-senhas-expirando
# nome: "AD - senhas prestes a expirar"
# descricao: "Lista usuários cujas senhas expiram nos próximos N dias, para aviso proativo."
# categoria: Active Directory
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 300
# requer_admin: false
# tags: [ad, senha]
# variaveis:
#   - nome: DIAS
#     rotulo: "Expira em até (dias)"
#     tipo: numero
#     padrao: 14
#     obrigatorio: false
#     opcoes: []
#   - nome: SAIDA
#     rotulo: "Formato de saída"
#     tipo: selecao
#     padrao: "texto"
#     obrigatorio: false
#     opcoes: [texto, json]
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function Get-Num($v, $padrao) { if ("$v" -match '^\d+$') { [int]$v } else { $padrao } }
function Out-Dados($d) { if ("$env:FAROL_SAIDA" -eq 'json') { $d | ConvertTo-Json -Depth 4 } else { ($d | Format-Table -AutoSize | Out-String -Width 220).TrimEnd() } }

if (-not (Get-Module -ListAvailable ActiveDirectory)) { Write-Output "Módulo ActiveDirectory não encontrado (instale o RSAT)."; exit 1 }
Import-Module ActiveDirectory
$dias = Get-Num $env:FAROL_DIAS 14
$d = Get-ADUser -Filter 'Enabled -eq $true -and PasswordNeverExpires -eq $false' -Properties 'msDS-UserPasswordExpiryTimeComputed', EmailAddress | ForEach-Object {
  $e = [datetime]::FromFileTime($_.'msDS-UserPasswordExpiryTimeComputed')
  if ($e -gt (Get-Date) -and $e -lt (Get-Date).AddDays($dias)) { [pscustomobject]@{ Usuario = $_.SamAccountName; Email = $_.EmailAddress; Expira = $e.ToString('yyyy-MM-dd'); Dias = [int]($e - (Get-Date)).TotalDays } }
} | Sort-Object Dias
Out-Dados $d
exit 0
