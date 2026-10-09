# ---
# id: instalacoes-programas-eventos
# nome: "Instalações e remoções recentes de software (MsiInstaller)"
# descricao: "Lista eventos do MsiInstaller (11707 instalação, 11724 remoção) para rastrear quem instalou o quê e quando."
# categoria: Registro e logs do sistema
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 120
# requer_admin: true
# tags: [software, auditoria, eventos]
# variaveis:
#   - nome: DIAS
#     rotulo: "Janela (dias)"
#     tipo: numero
#     padrao: 30
#     obrigatorio: false
#     opcoes: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function Get-Num($v, $padrao) { if ("$v" -match '^\d+$') { [int]$v } else { $padrao } }

$ini = (Get-Date).AddDays(-(Get-Num $env:FAROL_DIAS 30))
$e = Get-WinEvent -FilterHashtable @{ LogName = 'Application'; ProviderName = 'MsiInstaller'; Id = 11707, 11724, 1033, 1034; StartTime = $ini } -ErrorAction SilentlyContinue
if (-not $e) { Write-Output "Sem eventos do MsiInstaller no período."; exit 0 }
$e | ForEach-Object { Write-Output ("{0}  {1}  {2}" -f $_.TimeCreated.ToString('yyyy-MM-dd HH:mm'), $_.UserId.Translate([Security.Principal.NTAccount]).Value, (($_.Message -split "`n")[0])) }
exit 0
