# ---
# id: info-sistema-completa
# nome: "Informações completas do sistema"
# descricao: "Relatório de hardware e SO: fabricante, modelo, serial, CPU, RAM, discos, GPU, BIOS, SO, uptime e domínio."
# categoria: Hardware e diagnóstico
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 120
# requer_admin: false
# tags: [hardware, inventario]
# variaveis:
#   - nome: SAIDA
#     rotulo: "Formato de saída"
#     tipo: selecao
#     padrao: "texto"
#     obrigatorio: false
#     opcoes: [texto, json]
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

$cs = Get-CimInstance Win32_ComputerSystem; $os = Get-CimInstance Win32_OperatingSystem; $bios = Get-CimInstance Win32_BIOS; $cpu = Get-CimInstance Win32_Processor | Select-Object -First 1
$d = [pscustomobject]@{
  Computador = $env:COMPUTERNAME; Fabricante = $cs.Manufacturer; Modelo = $cs.Model; Serial = $bios.SerialNumber
  CPU = $cpu.Name.Trim(); Nucleos = $cpu.NumberOfCores; Threads = $cpu.NumberOfLogicalProcessors
  RAM_GB = [math]::Round($cs.TotalPhysicalMemory / 1GB, 1); SO = $os.Caption; Build = $os.BuildNumber
  BIOS = "$($bios.SMBIOSBIOSVersion) ($($bios.ReleaseDate.ToString('yyyy-MM-dd')))"
  UptimeDias = [math]::Round(((Get-Date) - $os.LastBootUpTime).TotalDays, 1); Dominio = $cs.Domain; UsuarioLogado = $cs.UserName
  GPU = ((Get-CimInstance Win32_VideoController | ForEach-Object { $_.Name }) -join '; ')
  Discos = ((Get-CimInstance Win32_DiskDrive | ForEach-Object { "$($_.Model) $([math]::Round($_.Size/1GB))GB" }) -join '; ')
}
if ("$env:FAROL_SAIDA" -eq 'json') { $d | ConvertTo-Json } else { $d | Format-List | Out-String -Width 200 | Write-Output }
exit 0
