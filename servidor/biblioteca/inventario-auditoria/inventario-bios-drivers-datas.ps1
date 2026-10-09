# ---
# id: inventario-bios-drivers-datas
# nome: "Idade do hardware e firmware"
# descricao: "Reúne data do BIOS, do driver de vídeo, de rede e do chipset para ajudar no planejamento de atualização."
# categoria: Inventário e auditoria
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 120
# requer_admin: false
# tags: [firmware, drivers]
# variaveis: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

$b = Get-CimInstance Win32_BIOS
Write-Output ("BIOS: {0} ({1:yyyy-MM-dd})" -f $b.SMBIOSBIOSVersion, $b.ReleaseDate)
Get-CimInstance Win32_PnPSignedDriver | Where-Object { $_.DeviceClass -in 'DISPLAY', 'NET', 'SYSTEM', 'HDC', 'BLUETOOTH' -and $_.DriverDate -and $_.DeviceName } | Sort-Object DriverDate | Select-Object -First 25 DeviceClass, DeviceName, DriverVersion, @{n='Data';e={ $_.DriverDate.ToString('yyyy-MM-dd') }} | Format-Table -AutoSize | Out-String -Width 200 | Write-Output
exit 0
