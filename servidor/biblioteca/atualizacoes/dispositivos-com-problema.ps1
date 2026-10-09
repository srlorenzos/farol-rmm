# ---
# id: dispositivos-com-problema
# nome: "Dispositivos com erro no Gerenciador de Dispositivos"
# descricao: "Lista dispositivos PnP com código de erro (driver ausente, desabilitado, falha) para tratar chamados de hardware."
# categoria: Atualizações
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 120
# requer_admin: false
# tags: [drivers, pnp]
# variaveis: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

$r = Get-CimInstance Win32_PnPEntity | Where-Object { $_.ConfigManagerErrorCode -ne 0 }
if (-not $r) { Write-Output "Nenhum dispositivo com erro."; exit 0 }
$r | Select-Object Name, PNPClass, ConfigManagerErrorCode, DeviceID | Format-Table -AutoSize | Out-String -Width 200 | Write-Output
exit 0
