# ---
# id: diagnostico-desempenho-rapido
# nome: "Diagnóstico rápido de desempenho"
# descricao: "Coleta CPU, memória, disco, top processos, programas de inicialização e uptime para triagem de chamados de lentidão."
# categoria: Desempenho
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 180
# requer_admin: false
# tags: [lentidao, triagem]
# variaveis: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

$o = Get-CimInstance Win32_OperatingSystem
$cpu = [math]::Round(((1..3 | ForEach-Object { (Get-CimInstance Win32_PerfFormattedData_PerfOS_Processor -Filter "Name='_Total'").PercentProcessorTime; Start-Sleep 1 }) | Measure-Object -Average).Average, 1)
Write-Output ("CPU (média 3s): {0}%" -f $cpu)
Write-Output ("RAM em uso: {0:N0}% ({1:N1} GB livres)" -f (100 - $o.FreePhysicalMemory / $o.TotalVisibleMemorySize * 100), ($o.FreePhysicalMemory / 1MB))
Write-Output ("Uptime: {0:N1} dias" -f ((Get-Date) - $o.LastBootUpTime).TotalDays)
Get-Volume | Where-Object { $_.DriveType -eq 'Fixed' -and $_.DriveLetter } | ForEach-Object { Write-Output ("Disco {0}: {1:N0}% livre" -f $_.DriveLetter, ($_.SizeRemaining / $_.Size * 100)) }
Write-Output "-- Top 5 por CPU --"
Get-Process | Sort-Object CPU -Descending | Select-Object -First 5 Name, @{n='CPU_s';e={[int]$_.CPU}}, @{n='MemMB';e={[int]($_.WorkingSet64/1MB)}} | Format-Table -AutoSize | Out-String | Write-Output
Write-Output "-- Top 5 por memória --"
Get-Process | Sort-Object WorkingSet64 -Descending | Select-Object -First 5 Name, @{n='MemMB';e={[int]($_.WorkingSet64/1MB)}} | Format-Table -AutoSize | Out-String | Write-Output
Write-Output ("Itens de inicialização (Run): {0}" -f @(Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Run', 'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Run' -ErrorAction SilentlyContinue | ForEach-Object { $_.PSObject.Properties | Where-Object { $_.Name -notmatch '^PS' } }).Count)
exit 0
