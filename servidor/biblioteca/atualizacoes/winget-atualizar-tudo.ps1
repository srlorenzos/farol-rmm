# ---
# id: winget-atualizar-tudo
# nome: "winget - atualizar todos os aplicativos"
# descricao: "Atualiza todos os pacotes com atualização disponível via winget, em modo silencioso, com opção de excluir IDs."
# categoria: Atualizações
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 3600
# requer_admin: true
# tags: [winget, atualizacoes]
# variaveis:
#   - nome: EXCLUIR
#     rotulo: "IDs a excluir (separados por vírgula)"
#     tipo: texto
#     padrao: ""
#     obrigatorio: false
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

$w = Get-Command winget.exe -ErrorAction SilentlyContinue
if (-not $w) { $w = Get-ChildItem "$env:ProgramFiles\WindowsApps\Microsoft.DesktopAppInstaller_*\winget.exe" -ErrorAction SilentlyContinue | Sort-Object Name -Descending | Select-Object -First 1 }
if (-not $w) { Write-Output "winget não encontrado."; exit 1 }
$exe = if ($w.Source) { $w.Source } else { $w.FullName }
& $exe upgrade --accept-source-agreements 2>&1 | Out-String | Write-Output
if (-not (Test-Confirmar)) { Write-Output "Defina CONFIRMAR=true para aplicar as atualizações."; exit 0 }
$excl = ("$env:FAROL_EXCLUIR" -replace '\s', '').Split(',') | Where-Object { $_ -match '^[\w.+-]+$' }
$pk = & $exe upgrade --accept-source-agreements 2>&1 | Out-String
$ids = [regex]::Matches($pk, '(?m)^\S.*?\s{2,}([A-Za-z0-9][\w.+-]*\.[\w.+-]+)\s{2,}') | ForEach-Object { $_.Groups[1].Value } | Where-Object { $_ -notin $excl } | Select-Object -Unique
foreach ($id in $ids) { Write-Output "Atualizando $id"; & $exe upgrade --id $id --silent --accept-package-agreements --accept-source-agreements --disable-interactivity 2>&1 | Select-Object -Last 3 }
exit 0
