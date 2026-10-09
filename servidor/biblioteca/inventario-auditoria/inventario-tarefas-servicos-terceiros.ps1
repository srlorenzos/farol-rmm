# ---
# id: inventario-tarefas-servicos-terceiros
# nome: "Inventário de serviços e tarefas de terceiros"
# descricao: "Lista serviços e tarefas agendadas que não são da Microsoft, para identificar agentes (backup, EDR, RMM, VPN) instalados."
# categoria: Inventário e auditoria
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 120
# requer_admin: false
# tags: [servicos, agentes]
# variaveis: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

Write-Output "== Serviços de terceiros =="
Get-CimInstance Win32_Service | Where-Object { $_.PathName -and $_.PathName -notmatch '(?i)\\Windows\\(system32|syswow64)\\' -and $_.PathName -notmatch '(?i)Microsoft|Windows Defender' } | Select-Object Name, DisplayName, State, StartMode | Sort-Object Name | Format-Table -AutoSize | Out-String -Width 200 | Write-Output
Write-Output "== Tarefas de terceiros =="
Get-ScheduledTask | Where-Object { $_.TaskPath -notlike '\Microsoft\*' } | Select-Object TaskPath, TaskName, State | Format-Table -AutoSize | Out-String -Width 200 | Write-Output
exit 0
