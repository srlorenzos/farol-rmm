# ---
# id: mon-cpu-uso
# nome: "Monitor - uso de CPU"
# descricao: "Mede a média de uso de CPU em uma janela curta de amostragem."
# categoria: Monitoramento
# so: [windows]
# shell: powershell
# tipo: monitor
# tempo_limite: 90
# requer_admin: false
# tags: [cpu, desempenho, monitor]
# variaveis:
#   - nome: ALERTA
#     rotulo: "Alerta (%)"
#     tipo: numero
#     padrao: 85
#     obrigatorio: false
#     opcoes: []
#   - nome: CRITICO
#     rotulo: "Crítico (%)"
#     tipo: numero
#     padrao: 95
#     obrigatorio: false
#     opcoes: []
#   - nome: AMOSTRAS
#     rotulo: "Amostras (1 s cada)"
#     tipo: numero
#     padrao: 10
#     obrigatorio: false
#     opcoes: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function Get-Num($v, $padrao) { if ("$v" -match '^\d+$') { [int]$v } else { $padrao } }
function Out-Status($nivel, $msg) { Write-Output "FAROL_STATUS: $nivel $msg" }

$a = Get-Num $env:FAROL_ALERTA 85; $c = Get-Num $env:FAROL_CRITICO 95; $n = [math]::Min((Get-Num $env:FAROL_AMOSTRAS 10), 60)
$amostras = 1..$n | ForEach-Object { (Get-CimInstance Win32_PerfFormattedData_PerfOS_Processor -Filter "Name='_Total'").PercentProcessorTime; Start-Sleep -Seconds 1 }
$v = [math]::Round(($amostras | Measure-Object -Average).Average, 1)
$msg = "CPU média de $v% em $n s"
if ($v -ge $c) { Out-Status 'critico' $msg } elseif ($v -ge $a) { Out-Status 'alerta' $msg } else { Out-Status 'ok' $msg }
exit 0
