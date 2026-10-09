# ---
# id: contas-sem-uso-recente
# nome: "Contas locais sem logon recente"
# descricao: "Lista contas locais ativas que não fazem logon há N dias, candidatas a desativação."
# categoria: Usuários e contas
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 120
# requer_admin: false
# tags: [contas, higiene]
# variaveis:
#   - nome: DIAS
#     rotulo: "Dias sem logon"
#     tipo: numero
#     padrao: 90
#     obrigatorio: false
#     opcoes: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function Get-Num($v, $padrao) { if ("$v" -match '^\d+$') { [int]$v } else { $padrao } }

$lim = (Get-Date).AddDays(-(Get-Num $env:FAROL_DIAS 90))
$r = Get-LocalUser | Where-Object { $_.Enabled -and ($_.LastLogon -lt $lim -or -not $_.LastLogon) }
if (-not $r) { Write-Output "Nenhuma conta inativa."; exit 0 }
$r | Select-Object Name, LastLogon, PasswordLastSet | Format-Table -AutoSize | Out-String | Write-Output
exit 0
