# ---
# id: saude-bateria
# nome: "Saúde da bateria"
# descricao: "Gera o relatório de bateria (powercfg) e calcula capacidade atual versus projeto, ciclos e estado. Em desktops informa que não há bateria."
# categoria: Hardware e diagnóstico
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 120
# requer_admin: false
# tags: [bateria, notebook]
# variaveis: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

if (-not (Get-CimInstance Win32_Battery)) { Write-Output "Nenhuma bateria detectada (desktop)."; exit 0 }
$f = Join-Path $env:TEMP 'farol-bateria.xml'
powercfg /batteryreport /xml /output $f | Out-Null
if (Test-Path $f) {
  [xml]$x = Get-Content $f
  $b = $x.BatteryReport.Batteries.Battery
  $proj = [double]$b.DesignCapacity; $cheia = [double]$b.FullChargeCapacity
  Write-Output ("Fabricante: {0}`nProjeto: {1} mWh`nCarga cheia atual: {2} mWh`nSaúde: {3:N1}%`nCiclos: {4}" -f $b.Manufacturer, $proj, $cheia, ($cheia / $proj * 100), $b.CycleCount)
  Remove-Item $f -Force
}
$bat = Get-CimInstance Win32_Battery
Write-Output ("Carga atual: {0}% (estado {1})" -f $bat.EstimatedChargeRemaining, $bat.BatteryStatus)
exit 0
