# ---
# id: ad-contas-bloqueadas
# nome: "AD - contas bloqueadas"
# descricao: "Lista contas bloqueadas por tentativas de senha, com horário do bloqueio."
# categoria: Active Directory
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 120
# requer_admin: false
# tags: [ad, bloqueio]
# variaveis: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

if (-not (Get-Module -ListAvailable ActiveDirectory)) { Write-Output "Módulo ActiveDirectory não encontrado (instale o RSAT)."; exit 1 }
Import-Module ActiveDirectory
$r = Search-ADAccount -LockedOut | Select-Object Name, SamAccountName, LockedOut, LastLogonDate
if (-not $r) { Write-Output "Nenhuma conta bloqueada."; exit 0 }
$r | Format-Table -AutoSize | Out-String | Write-Output
exit 0
