# ---
# id: inventario-completo-json
# nome: "Inventário completo do endpoint (JSON)"
# descricao: "Coleta hardware, SO, rede, discos, software, atualizações, usuários e estado de segurança em um único JSON estruturado."
# categoria: Inventário e auditoria
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 300
# requer_admin: false
# tags: [inventario, json]
# variaveis: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

$cs = Get-CimInstance Win32_ComputerSystem; $os = Get-CimInstance Win32_OperatingSystem; $b = Get-CimInstance Win32_BIOS
$sw = Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*', 'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*' -ErrorAction SilentlyContinue | Where-Object DisplayName | Select-Object @{n='nome';e={$_.DisplayName}}, @{n='versao';e={$_.DisplayVersion}} | Sort-Object nome -Unique
$mp = Get-MpComputerStatus -ErrorAction SilentlyContinue
$inv = [ordered]@{
  host = $env:COMPUTERNAME; dominio = $cs.Domain; fabricante = $cs.Manufacturer; modelo = $cs.Model; serial = $b.SerialNumber
  so = @{ nome = $os.Caption; build = $os.BuildNumber; instalado = $os.InstallDate.ToString('s'); boot = $os.LastBootUpTime.ToString('s') }
  cpu = (Get-CimInstance Win32_Processor | Select-Object -First 1).Name.Trim(); ram_gb = [math]::Round($cs.TotalPhysicalMemory / 1GB, 1)
  discos = @(Get-Volume | Where-Object { $_.DriveType -eq 'Fixed' -and $_.DriveLetter } | ForEach-Object { @{ unidade = "$($_.DriveLetter):"; total_gb = [math]::Round($_.Size / 1GB, 1); livre_gb = [math]::Round($_.SizeRemaining / 1GB, 1) } })
  rede = @(Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { $_.IPAddress -notmatch '^(127|169\.254)' } | ForEach-Object { @{ interface = $_.InterfaceAlias; ip = $_.IPAddress } })
  seguranca = @{ defender = [bool]($mp -and $mp.RealTimeProtectionEnabled); firewall = @(Get-NetFirewallProfile | Where-Object Enabled).Count -eq 3 }
  ultimas_atualizacoes = @(Get-HotFix | Sort-Object InstalledOn -Descending | Select-Object -First 5 | ForEach-Object { $_.HotFixID })
  usuarios_locais = @(Get-LocalUser | Where-Object Enabled | ForEach-Object { $_.Name })
  software = @($sw)
}
$inv | ConvertTo-Json -Depth 5
exit 0
