# ---
# id: monitores-conectados
# nome: "Monitores conectados"
# descricao: "Lista monitores com fabricante, modelo, serial e ano de fabricação lidos do EDID."
# categoria: Hardware e diagnóstico
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 120
# requer_admin: false
# tags: [monitores, inventario]
# variaveis: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

function Dec($a) { ($a | Where-Object { $_ -ne 0 } | ForEach-Object { [char]$_ }) -join '' }
$m = Get-CimInstance -Namespace root\wmi -ClassName WmiMonitorID -ErrorAction SilentlyContinue
if (-not $m) { Write-Output "Nenhum monitor retornado (sessão sem vídeo?)."; exit 0 }
$m | ForEach-Object { [pscustomobject]@{ Fabricante = Dec $_.ManufacturerName; Modelo = Dec $_.UserFriendlyName; Serial = Dec $_.SerialNumberID; Ano = $_.YearOfManufacture } } | Format-Table -AutoSize | Out-String | Write-Output
exit 0
