# ---
# id: temperatura-hardware
# nome: "Temperatura do processador e zonas térmicas"
# descricao: "Lê zonas térmicas ACPI (MSAcpi_ThermalZoneTemperature) e discos; informa quando o fabricante não expõe sensores."
# categoria: Hardware e diagnóstico
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 120
# requer_admin: true
# tags: [temperatura]
# variaveis: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

$z = Get-CimInstance -Namespace root\wmi -ClassName MSAcpi_ThermalZoneTemperature -ErrorAction SilentlyContinue
if ($z) { $z | ForEach-Object { Write-Output ("{0}: {1:N1} C" -f $_.InstanceName, ($_.CurrentTemperature / 10 - 273.15)) } } else { Write-Output "Sensores ACPI não expostos neste hardware." }
Get-PhysicalDisk | ForEach-Object { $c = $_ | Get-StorageReliabilityCounter -ErrorAction SilentlyContinue; if ($c.Temperature) { Write-Output ("Disco {0}: {1} C" -f $_.FriendlyName, $c.Temperature) } }
exit 0
