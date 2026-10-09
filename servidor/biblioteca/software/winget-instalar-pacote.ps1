# ---
# id: winget-instalar-pacote
# nome: "winget - instalar pacote"
# descricao: "Instala um pacote pelo ID do winget (ex.: 7zip.7zip, Google.Chrome) em modo silencioso e no escopo da máquina. Idempotente."
# categoria: Software
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 1200
# requer_admin: true
# tags: [winget, instalacao]
# variaveis:
#   - nome: PACOTE
#     rotulo: "ID do pacote winget"
#     tipo: texto
#     padrao: ""
#     obrigatorio: true
#     opcoes: []
#   - nome: VERSAO
#     rotulo: "Versão específica (opcional)"
#     tipo: texto
#     padrao: ""
#     obrigatorio: false
#     opcoes: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

$id = "$env:FAROL_PACOTE".Trim()
if ($id -notmatch '^[A-Za-z0-9][\w.+-]{1,100}$') { Write-Output "ID de pacote inválido: $id"; exit 1 }
$w = Get-Command winget.exe -ErrorAction SilentlyContinue
if (-not $w) { $w = Get-ChildItem "$env:ProgramFiles\WindowsApps\Microsoft.DesktopAppInstaller_*\winget.exe" -ErrorAction SilentlyContinue | Sort-Object Name -Descending | Select-Object -First 1 }
if (-not $w) { Write-Output "winget não encontrado (requer Windows 10 1809+ com App Installer)."; exit 1 }
$exe = if ($w.Source) { $w.Source } else { $w.FullName }
$a = @('install', '--id', $id, '--exact', '--silent', '--accept-package-agreements', '--accept-source-agreements', '--scope', 'machine', '--disable-interactivity')
if ($env:FAROL_VERSAO -match '^[\w.+-]+$') { $a += @('--version', $env:FAROL_VERSAO) }
& $exe @a 2>&1 | Out-String | Write-Output
if ($LASTEXITCODE -eq 0 -or $LASTEXITCODE -eq -1978335189) { Write-Output "OK (instalado ou já atualizado)."; exit 0 }
Write-Output "winget retornou código $LASTEXITCODE"
exit 1
