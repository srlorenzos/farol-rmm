# ---
# id: mon-temperatura-termica
# nome: "Monitor - temperatura (zonas térmicas ACPI)"
# descricao: "Lê a temperatura das zonas térmicas quando o hardware as expõe; senão reporta ok informando ausência de sensor."
# categoria: Monitoramento
# so: [windows]
# shell: powershell
# tipo: monitor
# tempo_limite: 60
# requer_admin: false
# tags: [temperatura, monitor]
# variaveis:
#   - nome: ALERTA
#     rotulo: "Alerta (C)"
#     tipo: numero
#     padrao: 80
#     obrigatorio: false
#     opcoes: []
#   - nome: CRITICO
#     rotulo: "Crítico (C)"
#     tipo: numero
#     padrao: 90
#     obrigatorio: false
#     opcoes: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function Get-Num($v, $padrao) { if ("$v" -match '^\d+$') { [int]$v } else { $padrao } }
function Out-Status($nivel, $msg) { Write-Output "FAROL_STATUS: $nivel $msg" }

$a = Get-Num $env:FAROL_ALERTA 80; $c = Get-Num $env:FAROL_CRITICO 90
$z = Get-CimInstance -Namespace root\wmi -ClassName MSAcpi_ThermalZoneTemperature -ErrorAction SilentlyContinue
if (-not $z) { Out-Status 'ok' 'Sensor térmico ACPI não disponível neste equipamento'; exit 0 }
$max = ($z | ForEach-Object { $_.CurrentTemperature / 10 - 273.15 } | Measure-Object -Maximum).Maximum
$msg = "Temperatura máxima $([math]::Round($max,1)) C"
if ($max -ge $c) { Out-Status 'critico' $msg } elseif ($max -ge $a) { Out-Status 'alerta' $msg } else { Out-Status 'ok' $msg }
exit 0
