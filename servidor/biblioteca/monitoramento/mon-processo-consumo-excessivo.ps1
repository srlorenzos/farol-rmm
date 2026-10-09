# ---
# id: mon-processo-consumo-excessivo
# nome: "Monitor - processo consumindo memória excessiva"
# descricao: "Alerta se algum processo usa mais memória do que o limite (MB), apontando o culpado."
# categoria: Monitoramento
# so: [windows]
# shell: powershell
# tipo: monitor
# tempo_limite: 60
# requer_admin: false
# tags: [processos, memoria, monitor]
# variaveis:
#   - nome: ALERTA_MB
#     rotulo: "Alerta (MB)"
#     tipo: numero
#     padrao: 2000
#     obrigatorio: false
#     opcoes: []
#   - nome: CRITICO_MB
#     rotulo: "Crítico (MB)"
#     tipo: numero
#     padrao: 4000
#     obrigatorio: false
#     opcoes: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function Get-Num($v, $padrao) { if ("$v" -match '^\d+$') { [int]$v } else { $padrao } }
function Out-Status($nivel, $msg) { Write-Output "FAROL_STATUS: $nivel $msg" }

$a = Get-Num $env:FAROL_ALERTA_MB 2000; $c = Get-Num $env:FAROL_CRITICO_MB 4000
$t = Get-Process | Group-Object ProcessName | ForEach-Object { [pscustomobject]@{ N = $_.Name; MB = [math]::Round(($_.Group | Measure-Object WorkingSet64 -Sum).Sum / 1MB) } } | Sort-Object MB -Descending | Select-Object -First 1
$msg = "Maior consumo: $($t.N) com $($t.MB) MB"
if ($t.MB -ge $c) { Out-Status 'critico' $msg } elseif ($t.MB -ge $a) { Out-Status 'alerta' $msg } else { Out-Status 'ok' $msg }
exit 0
