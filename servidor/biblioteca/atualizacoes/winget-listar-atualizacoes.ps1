# ---
# id: winget-listar-atualizacoes
# nome: "winget - listar atualizações disponíveis"
# descricao: "Lista os aplicativos instalados que possuem versão mais nova disponível via winget."
# categoria: Atualizações
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 300
# requer_admin: false
# tags: [winget, atualizacoes]
# variaveis: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

$w = Get-Command winget.exe -ErrorAction SilentlyContinue
if (-not $w) { $w = Get-ChildItem "$env:ProgramFiles\WindowsApps\Microsoft.DesktopAppInstaller_*\winget.exe" -ErrorAction SilentlyContinue | Select-Object -First 1 }
if (-not $w) { Write-Output "winget não encontrado neste computador."; exit 1 }
$exe = if ($w.Source) { $w.Source } else { $w.FullName }
& $exe upgrade --accept-source-agreements 2>&1 | Out-String | Write-Output
exit 0
