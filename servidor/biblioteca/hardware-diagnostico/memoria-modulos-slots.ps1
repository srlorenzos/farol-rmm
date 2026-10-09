# ---
# id: memoria-modulos-slots
# nome: "Módulos de memória RAM e slots"
# descricao: "Lista módulos de memória físicos (capacidade, velocidade, tipo, fabricante, slot) e a capacidade máxima da placa."
# categoria: Hardware e diagnóstico
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 120
# requer_admin: false
# tags: [memoria, ram]
# variaveis: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

Get-CimInstance Win32_PhysicalMemory | Select-Object BankLabel, DeviceLocator, @{n='GB';e={[math]::Round($_.Capacity/1GB)}}, Speed, ConfiguredClockSpeed, Manufacturer, PartNumber, SMBIOSMemoryType | Format-Table -AutoSize | Out-String -Width 200 | Write-Output
$a = Get-CimInstance Win32_PhysicalMemoryArray
Write-Output ("Slots: {0}; capacidade máxima: {1} GB" -f $a.MemoryDevices, [math]::Round($a.MaxCapacity / 1MB))
exit 0
