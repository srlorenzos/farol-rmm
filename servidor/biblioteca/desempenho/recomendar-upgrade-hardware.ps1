# ---
# id: recomendar-upgrade-hardware
# nome: "Avaliar necessidade de upgrade de hardware"
# descricao: "Analisa RAM, tipo de disco (HDD/SSD), CPU e idade do equipamento e sugere ações (mais RAM, trocar HDD por SSD, substituir)."
# categoria: Desempenho
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 120
# requer_admin: false
# tags: [hardware, upgrade]
# variaveis: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

$cs = Get-CimInstance Win32_ComputerSystem; $b = Get-CimInstance Win32_BIOS; $cpu = Get-CimInstance Win32_Processor | Select-Object -First 1
$ram = [math]::Round($cs.TotalPhysicalMemory / 1GB)
$anos = [math]::Round(((Get-Date) - $b.ReleaseDate).TotalDays / 365, 1)
$sis = (Get-PhysicalDisk | Where-Object { $_.DeviceId -eq (Get-Partition -DriveLetter C -ErrorAction SilentlyContinue | Get-Disk).Number } | Select-Object -First 1).MediaType
Write-Output "RAM: $ram GB | Disco do sistema: $sis | CPU: $($cpu.Name.Trim()) | Idade do BIOS: $anos anos"
$s = @()
if ($ram -lt 8) { $s += 'Aumentar a RAM para pelo menos 8 GB (16 GB recomendado).' }
if ($sis -eq 'HDD') { $s += 'Trocar o HDD por SSD: maior ganho de desempenho percebido.' }
if ($anos -ge 6) { $s += 'Equipamento com mais de 6 anos: planejar substituição.' }
if ($cpu.NumberOfCores -lt 4) { $s += 'CPU com menos de 4 núcleos: pode ser limitante.' }
if ($s) { $s | ForEach-Object { Write-Output "- $_" } } else { Write-Output "Hardware adequado para uso de escritório." }
exit 0
