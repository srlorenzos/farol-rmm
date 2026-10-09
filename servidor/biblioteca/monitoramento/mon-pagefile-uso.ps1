# ---
# id: mon-pagefile-uso
# nome: "Monitor - uso do arquivo de paginação"
# descricao: "Avalia o percentual de uso do pagefile, indicando falta de memória."
# categoria: Monitoramento
# so: [windows]
# shell: powershell
# tipo: monitor
# tempo_limite: 60
# requer_admin: false
# tags: [memoria, pagefile, monitor]
# variaveis:
#   - nome: ALERTA
#     rotulo: "Alerta (%)"
#     tipo: numero
#     padrao: 70
#     obrigatorio: false
#     opcoes: []
#   - nome: CRITICO
#     rotulo: "Crítico (%)"
#     tipo: numero
#     padrao: 90
#     obrigatorio: false
#     opcoes: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function Get-Num($v, $padrao) { if ("$v" -match '^\d+$') { [int]$v } else { $padrao } }
function Out-Status($nivel, $msg) { Write-Output "FAROL_STATUS: $nivel $msg" }

$a = Get-Num $env:FAROL_ALERTA 70; $c = Get-Num $env:FAROL_CRITICO 90
$p = Get-CimInstance Win32_PageFileUsage | Select-Object -First 1
if (-not $p) { Out-Status 'alerta' 'Sem pagefile configurado'; exit 0 }
$pct = [math]::Round($p.CurrentUsage / $p.AllocatedBaseSize * 100, 0)
$msg = "Pagefile $pct% em uso ($($p.CurrentUsage) de $($p.AllocatedBaseSize) MB)"
if ($pct -ge $c) { Out-Status 'critico' $msg } elseif ($pct -ge $a) { Out-Status 'alerta' $msg } else { Out-Status 'ok' $msg }
exit 0
