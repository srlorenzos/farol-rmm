# ---
# id: amostra-contadores-desempenho
# nome: "Amostragem de contadores de desempenho"
# descricao: "Coleta contadores (CPU, memória, disco, rede) por um período e mostra mínimo, média e máximo de cada um."
# categoria: Desempenho
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 300
# requer_admin: false
# tags: [contadores, perfmon]
# variaveis:
#   - nome: SEGUNDOS
#     rotulo: "Duração da amostragem (s)"
#     tipo: numero
#     padrao: 30
#     obrigatorio: false
#     opcoes: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function Get-Num($v, $padrao) { if ("$v" -match '^\d+$') { [int]$v } else { $padrao } }

$s = [math]::Min((Get-Num $env:FAROL_SEGUNDOS 30), 240)
$amostras = 1..$s | ForEach-Object {
  $cpu = (Get-CimInstance Win32_PerfFormattedData_PerfOS_Processor -Filter "Name='_Total'").PercentProcessorTime
  $mem = (Get-CimInstance Win32_PerfFormattedData_PerfOS_Memory).AvailableMBytes
  $dk = Get-CimInstance Win32_PerfFormattedData_PerfDisk_PhysicalDisk -Filter "Name='_Total'"
  $rede = (Get-CimInstance Win32_PerfFormattedData_Tcpip_NetworkInterface | Measure-Object BytesTotalPersec -Sum).Sum
  [pscustomobject]@{ CPU = $cpu; MemDisponivelMB = $mem; DiscoAtivoPct = $dk.PercentDiskTime; FilaDisco = $dk.CurrentDiskQueueLength; RedeKBs = [math]::Round($rede / 1KB) }
  Start-Sleep -Seconds 1
}
'CPU', 'MemDisponivelMB', 'DiscoAtivoPct', 'FilaDisco', 'RedeKBs' | ForEach-Object {
  $c = $_
  $m = $amostras | Measure-Object $c -Average -Minimum -Maximum
  [pscustomobject]@{ Contador = $c; Min = [math]::Round($m.Minimum, 1); Media = [math]::Round($m.Average, 1); Max = [math]::Round($m.Maximum, 1) }
} | Format-Table -AutoSize | Out-String | Write-Output
exit 0
