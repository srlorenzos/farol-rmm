# ---
# id: inventario-resumo-hardware-software
# nome: "Resumo de inventário legível"
# descricao: "Versão em texto do inventário: identificação, SO, CPU/RAM, discos, rede e contagem de softwares."
# categoria: Inventário e auditoria
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 120
# requer_admin: false
# tags: [inventario]
# variaveis: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

$cs = Get-CimInstance Win32_ComputerSystem; $os = Get-CimInstance Win32_OperatingSystem; $b = Get-CimInstance Win32_BIOS
Write-Output ("Host: {0} | Domínio/Grupo: {1}" -f $env:COMPUTERNAME, $cs.Domain)
Write-Output ("Equipamento: {0} {1} | Serial: {2}" -f $cs.Manufacturer, $cs.Model, $b.SerialNumber)
Write-Output ("SO: {0} build {1} | Instalado em {2:yyyy-MM-dd}" -f $os.Caption, $os.BuildNumber, $os.InstallDate)
Write-Output ("CPU: {0} | RAM: {1:N1} GB" -f (Get-CimInstance Win32_Processor | Select-Object -First 1).Name.Trim(), ($cs.TotalPhysicalMemory / 1GB))
Get-Volume | Where-Object { $_.DriveType -eq 'Fixed' -and $_.DriveLetter } | ForEach-Object { Write-Output ("Disco {0}: {1:N0} GB ({2:N0} GB livres)" -f $_.DriveLetter, ($_.Size / 1GB), ($_.SizeRemaining / 1GB)) }
Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { $_.IPAddress -notmatch '^(127|169\.254)' } | ForEach-Object { Write-Output ("IP {0}: {1}" -f $_.InterfaceAlias, $_.IPAddress) }
Write-Output ("Programas instalados: {0}" -f @(Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*', 'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*' -ErrorAction SilentlyContinue | Where-Object DisplayName).Count)
exit 0
