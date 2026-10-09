# ---
# id: exportar-software-csv
# nome: "Exportar inventário de software para CSV"
# descricao: "Gera um CSV com todos os programas instalados (nome, versão, fabricante) em uma pasta, útil para coleta posterior."
# categoria: Software
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 120
# requer_admin: false
# tags: [software, csv, inventario]
# variaveis:
#   - nome: DESTINO
#     rotulo: "Pasta de destino"
#     tipo: texto
#     padrao: "C:\\Windows\\Temp"
#     obrigatorio: false
#     opcoes: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

$d = if ($env:FAROL_DESTINO) { $env:FAROL_DESTINO } else { "$env:windir\Temp" }
New-Item $d -ItemType Directory -Force | Out-Null
$f = Join-Path $d "software-$env:COMPUTERNAME-$(Get-Date -Format yyyyMMdd).csv"
$ks = 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*', 'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*'
Get-ItemProperty $ks -ErrorAction SilentlyContinue | Where-Object DisplayName | Select-Object DisplayName, DisplayVersion, Publisher, InstallDate | Sort-Object DisplayName -Unique | Export-Csv $f -NoTypeInformation -Encoding UTF8
Write-Output "Arquivo gerado: $f ($((Import-Csv $f).Count) itens)"
exit 0
