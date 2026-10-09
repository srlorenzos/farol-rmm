# ---
# id: ad-usuarios-inativos
# nome: "AD - usuários inativos"
# descricao: "Lista contas de usuário habilitadas sem logon há N dias no Active Directory (requer módulo ActiveDirectory/RSAT)."
# categoria: Active Directory
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 300
# requer_admin: false
# tags: [ad, higiene]
# variaveis:
#   - nome: DIAS
#     rotulo: "Dias sem logon"
#     tipo: numero
#     padrao: 90
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

if (-not (Get-Module -ListAvailable ActiveDirectory)) { Write-Output "Módulo ActiveDirectory não encontrado. Instale o RSAT (Add-WindowsCapability -Online -Name Rsat.ActiveDirectory*)."; exit 1 }
Import-Module ActiveDirectory
$dias = Get-Num $env:FAROL_DIAS 90
$d = Search-ADAccount -AccountInactive -UsersOnly -TimeSpan ([timespan]::FromDays($dias)) | Where-Object Enabled | Select-Object Name, SamAccountName, LastLogonDate, DistinguishedName
Out-Dados $d
exit 0
