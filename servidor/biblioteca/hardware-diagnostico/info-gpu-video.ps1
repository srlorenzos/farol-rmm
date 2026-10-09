# ---
# id: info-gpu-video
# nome: "Informações da placa de vídeo"
# descricao: "Lista adaptadores de vídeo com VRAM, versão e data do driver, resolução atual."
# categoria: Hardware e diagnóstico
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 120
# requer_admin: false
# tags: [gpu, drivers]
# variaveis: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

Get-CimInstance Win32_VideoController | Select-Object Name, @{n='VRAM_MB';e={[math]::Round($_.AdapterRAM/1MB)}}, DriverVersion, DriverDate, CurrentHorizontalResolution, CurrentVerticalResolution, CurrentRefreshRate, Status | Format-List | Out-String | Write-Output
exit 0
