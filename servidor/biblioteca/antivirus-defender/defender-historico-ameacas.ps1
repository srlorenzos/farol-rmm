# ---
# id: defender-historico-ameacas
# nome: "Histórico de ameaças do Defender"
# descricao: "Lista ameaças detectadas e ações tomadas (quarentena, remoção) nos últimos dias, via log operacional do Defender."
# categoria: Antivírus e Defender
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 120
# requer_admin: true
# tags: [defender, ameacas]
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
$e = Get-WinEvent -FilterHashtable @{ LogName = 'Microsoft-Windows-Windows Defender/Operational'; Id = 1116, 1117, 1118, 1119; StartTime = $ini } -ErrorAction SilentlyContinue
if (-not $e) { Write-Output "Nenhuma detecção no período."; exit 0 }
$e | ForEach-Object { Write-Output ("{0}  [{1}]  {2}" -f $_.TimeCreated.ToString('yyyy-MM-dd HH:mm'), $_.Id, (($_.Message -split "`n" | Where-Object { $_ -match 'Name:|Nome:|Path:|Caminho:' } | Select-Object -First 2) -join ' | ')) }
exit 0
