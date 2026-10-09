# ---
# id: relatorio-confiabilidade
# nome: "Relatório de confiabilidade do Windows"
# descricao: "Resume falhas de aplicativos, do Windows e de driver registradas no Monitor de Confiabilidade nos últimos dias."
# categoria: Hardware e diagnóstico
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 120
# requer_admin: false
# tags: [confiabilidade, falhas]
# variaveis:
#   - nome: DIAS
#     rotulo: "Janela (dias)"
#     tipo: numero
#     padrao: 14
#     obrigatorio: false
#     opcoes: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function Get-Num($v, $padrao) { if ("$v" -match '^\d+$') { [int]$v } else { $padrao } }

$ini = (Get-Date).AddDays(-(Get-Num $env:FAROL_DIAS 14))
$r = Get-CimInstance Win32_ReliabilityRecords -ErrorAction SilentlyContinue | Where-Object { $_.TimeGenerated -gt $ini }
if (-not $r) { Write-Output "Sem registros no período."; exit 0 }
$r | Group-Object SourceName, EventIdentifier | Sort-Object Count -Descending | Select-Object -First 15 Count, Name | Format-Table -AutoSize | Out-String | Write-Output
exit 0
