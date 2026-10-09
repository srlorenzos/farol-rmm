# ---
# id: coletar-diagnostico-zip
# nome: "Coletar pacote de diagnóstico (ZIP)"
# descricao: "Reúne informações do sistema, eventos recentes, hotfixes, drivers, rede e serviços em um ZIP para análise de suporte."
# categoria: Registro e logs do sistema
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 600
# requer_admin: true
# tags: [diagnostico, zip, suporte]
# variaveis:
#   - nome: DESTINO
#     rotulo: "Pasta de destino"
#     tipo: texto
#     padrao: "C:\\Windows\\Temp"
#     obrigatorio: false
#     opcoes: []
#   - nome: HORAS
#     rotulo: "Eventos das últimas (horas)"
#     tipo: numero
#     padrao: 48
#     obrigatorio: false
#     opcoes: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function Get-Num($v, $padrao) { if ("$v" -match '^\d+$') { [int]$v } else { $padrao } }
function Format-Tam($b) { if ($b -ge 1GB) { '{0:N2} GB' -f ($b / 1GB) } elseif ($b -ge 1MB) { '{0:N1} MB' -f ($b / 1MB) } else { '{0:N0} KB' -f ($b / 1KB) } }

$d = if ($env:FAROL_DESTINO) { $env:FAROL_DESTINO } else { "$env:windir\Temp" }
$h = Get-Num $env:FAROL_HORAS 48
$w = Join-Path $env:TEMP ("farol-diag-" + [guid]::NewGuid().ToString('N')); New-Item $w -ItemType Directory -Force | Out-Null
systeminfo > "$w\systeminfo.txt" 2>&1
ipconfig /all > "$w\ipconfig.txt" 2>&1
Get-HotFix | Out-String > "$w\hotfixes.txt"
Get-CimInstance Win32_Service | Select-Object Name, State, StartMode, StartName | Out-String -Width 200 > "$w\servicos.txt"
Get-Process | Sort-Object WorkingSet64 -Descending | Select-Object -First 40 Name, Id, CPU, WorkingSet64 | Out-String > "$w\processos.txt"
Get-WindowsDriver -Online -ErrorAction SilentlyContinue | Select-Object Driver, ProviderName, Version, Date | Out-String -Width 200 > "$w\drivers.txt"
foreach ($l in 'System', 'Application') { Get-WinEvent -FilterHashtable @{ LogName = $l; Level = 1, 2, 3; StartTime = (Get-Date).AddHours(-$h) } -MaxEvents 500 -ErrorAction SilentlyContinue | Select-Object TimeCreated, Id, ProviderName, LevelDisplayName, Message | Export-Csv "$w\eventos-$l.csv" -NoTypeInformation -Encoding UTF8 }
New-Item $d -ItemType Directory -Force | Out-Null
$z = Join-Path $d ("diagnostico-{0}-{1:yyyyMMdd-HHmm}.zip" -f $env:COMPUTERNAME, (Get-Date))
Compress-Archive -Path "$w\*" -DestinationPath $z -Force
Remove-Item $w -Recurse -Force
Write-Output ("Pacote gerado: {0} ({1})" -f $z, (Format-Tam (Get-Item $z).Length))
exit 0
