# ---
# id: mon-bateria-saude
# nome: "Monitor - desgaste da bateria"
# descricao: "Calcula a saúde da bateria (capacidade atual vs projeto) em notebooks."
# categoria: Monitoramento
# so: [windows]
# shell: powershell
# tipo: monitor
# tempo_limite: 90
# requer_admin: false
# tags: [bateria, monitor]
# variaveis:
#   - nome: ALERTA
#     rotulo: "Alerta abaixo de (% de saúde)"
#     tipo: numero
#     padrao: 60
#     obrigatorio: false
#     opcoes: []
#   - nome: CRITICO
#     rotulo: "Crítico abaixo de (% de saúde)"
#     tipo: numero
#     padrao: 40
#     obrigatorio: false
#     opcoes: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function Get-Num($v, $padrao) { if ("$v" -match '^\d+$') { [int]$v } else { $padrao } }
function Out-Status($nivel, $msg) { Write-Output "FAROL_STATUS: $nivel $msg" }

if (-not (Get-CimInstance Win32_Battery)) { Out-Status 'ok' 'Sem bateria (desktop)'; exit 0 }
$a = Get-Num $env:FAROL_ALERTA 60; $c = Get-Num $env:FAROL_CRITICO 40
$f = Join-Path $env:TEMP 'farol-bat.xml'
powercfg /batteryreport /xml /output $f | Out-Null
if (-not (Test-Path $f)) { Out-Status 'alerta' 'Não foi possível gerar o relatório de bateria'; exit 0 }
[xml]$x = Get-Content $f; Remove-Item $f -Force
$b = $x.BatteryReport.Batteries.Battery | Select-Object -First 1
$s = [math]::Round([double]$b.FullChargeCapacity / [double]$b.DesignCapacity * 100, 0)
$msg = "Saúde da bateria $s% (ciclos: $($b.CycleCount))"
if ($s -lt $c) { Out-Status 'critico' $msg } elseif ($s -lt $a) { Out-Status 'alerta' $msg } else { Out-Status 'ok' $msg }
exit 0
