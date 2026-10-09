# ---
# id: m365-estado-office-licenca-ativacao
# nome: "Office - estado de ativação e canal de atualização"
# descricao: "Mostra versão do Microsoft 365 Apps, canal de atualização, arquitetura e estado de licença (ospp.vbs)."
# categoria: Microsoft 365
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 120
# requer_admin: false
# tags: [office, licenca]
# variaveis: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

$c = Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Office\ClickToRun\Configuration' -ErrorAction SilentlyContinue
if ($c) { Write-Output ("Versão: {0}`nCanal: {1}`nPlataforma: {2}`nProdutos: {3}" -f $c.VersionToReport, $c.CDNBaseUrl, $c.Platform, $c.ProductReleaseIds) } else { Write-Output "Office Click-to-Run não encontrado." }
$o = Get-ChildItem "$env:ProgramFiles\Microsoft Office\Office16\OSPP.VBS", "${env:ProgramFiles(x86)}\Microsoft Office\Office16\OSPP.VBS" -ErrorAction SilentlyContinue | Select-Object -First 1
if ($o) { cscript //nologo $o.FullName /dstatus | Select-String 'LICENSE NAME|LICENSE STATUS|Last 5' | ForEach-Object { $_.Line } }
exit 0
