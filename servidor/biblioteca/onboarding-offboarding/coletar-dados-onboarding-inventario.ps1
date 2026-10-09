# ---
# id: coletar-dados-onboarding-inventario
# nome: "Registrar equipamento no inventário (arquivo JSON)"
# descricao: "Gera um JSON com identificação do equipamento (serial, MAC, modelo, SO, RAM, discos) para cadastro no inventário/CMDB."
# categoria: Onboarding e offboarding
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 120
# requer_admin: false
# tags: [onboarding, inventario, json]
# variaveis: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

$cs = Get-CimInstance Win32_ComputerSystem; $b = Get-CimInstance Win32_BIOS; $o = Get-CimInstance Win32_OperatingSystem
$o2 = [pscustomobject]@{
  Hostname = $env:COMPUTERNAME; Fabricante = $cs.Manufacturer; Modelo = $cs.Model; Serial = $b.SerialNumber; SO = $o.Caption; Build = $o.BuildNumber
  RAM_GB = [math]::Round($cs.TotalPhysicalMemory / 1GB); CPU = (Get-CimInstance Win32_Processor | Select-Object -First 1).Name.Trim()
  Discos = @(Get-CimInstance Win32_DiskDrive | ForEach-Object { [pscustomobject]@{ Modelo = $_.Model; GB = [math]::Round($_.Size / 1GB) } })
  MACs = @(Get-NetAdapter -Physical | ForEach-Object { $_.MacAddress }); Dominio = $cs.Domain; Data = (Get-Date).ToString('s')
}
$o2 | ConvertTo-Json -Depth 4
exit 0
