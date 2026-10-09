# ---
# id: winget-desinstalar-pacote
# nome: "winget - desinstalar pacote"
# descricao: "Desinstala silenciosamente um pacote pelo ID do winget. Exige confirmação."
# categoria: Software
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 1200
# requer_admin: true
# tags: [winget, desinstalacao]
# variaveis:
#   - nome: PACOTE
#     rotulo: "ID do pacote winget"
#     tipo: texto
#     padrao: ""
#     obrigatorio: true
#     opcoes: []
#   - nome: CONFIRMAR
#     rotulo: "Digite true para confirmar a execução"
#     tipo: booleano
#     padrao: false
#     obrigatorio: false
#     opcoes: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function Test-Confirmar { "$env:FAROL_CONFIRMAR" -match '^(1|true|sim|s|yes|y|verdadeiro)$' }

$id = "$env:FAROL_PACOTE".Trim()
if ($id -notmatch '^[A-Za-z0-9][\w.+-]{1,100}$') { Write-Output "ID inválido."; exit 1 }
$w = Get-Command winget.exe -ErrorAction SilentlyContinue
if (-not $w) { $w = Get-ChildItem "$env:ProgramFiles\WindowsApps\Microsoft.DesktopAppInstaller_*\winget.exe" -ErrorAction SilentlyContinue | Sort-Object Name -Descending | Select-Object -First 1 }
if (-not $w) { Write-Output "winget não encontrado."; exit 1 }
$exe = if ($w.Source) { $w.Source } else { $w.FullName }
if (-not (Test-Confirmar)) { Write-Output "Defina CONFIRMAR=true para desinstalar $id."; & $exe list --id $id --exact 2>&1 | Out-String | Write-Output; exit 0 }
& $exe uninstall --id $id --exact --silent --accept-source-agreements --disable-interactivity 2>&1 | Out-String | Write-Output
exit $LASTEXITCODE
