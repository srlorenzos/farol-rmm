# ---
# id: mon-latencia-disco
# nome: "Monitor - latência e fila de disco"
# descricao: "Mede a latência média de leitura/escrita e fila de disco por alguns segundos."
# categoria: Monitoramento
# so: [windows]
# shell: powershell
# tipo: monitor
# tempo_limite: 90
# requer_admin: false
# tags: [disco, desempenho, monitor]
# variaveis:
#   - nome: ALERTA_MS
#     rotulo: "Alerta (ms)"
#     tipo: numero
#     padrao: 30
#     obrigatorio: false
#     opcoes: []
#   - nome: CRITICO_MS
#     rotulo: "Crítico (ms)"
#     tipo: numero
#     padrao: 100
#     obrigatorio: false
#     opcoes: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function Get-Num($v, $padrao) { if ("$v" -match '^\d+$') { [int]$v } else { $padrao } }
function Out-Status($nivel, $msg) { Write-Output "FAROL_STATUS: $nivel $msg" }

$a = Get-Num $env:FAROL_ALERTA_MS 30; $c = Get-Num $env:FAROL_CRITICO_MS 100
$lats = @(); $filas = @()
1..5 | ForEach-Object {
  $d = Get-CimInstance Win32_PerfFormattedData_PerfDisk_PhysicalDisk -Filter "Name='_Total'"
  $lats += [math]::Max($d.AvgDisksecPerRead, $d.AvgDisksecPerWrite); $filas += $d.CurrentDiskQueueLength; Start-Sleep -Seconds 1
}
$lat = ($lats | Measure-Object -Average).Average * 1000
$fila = ($filas | Measure-Object -Average).Average
$msg = ("Latência média {0:N1} ms; fila {1:N1}" -f $lat, $fila)
if ($lat -ge $c) { Out-Status 'critico' $msg } elseif ($lat -ge $a) { Out-Status 'alerta' $msg } else { Out-Status 'ok' $msg }
exit 0
