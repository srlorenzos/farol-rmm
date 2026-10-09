# ---
# id: m365-reparar-onedrive
# nome: "OneDrive - redefinir cliente de sincronização"
# descricao: "Executa onedrive.exe /reset para reconstruir o estado de sincronização sem apagar arquivos locais, e reinicia o cliente."
# categoria: Microsoft 365
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 120
# requer_admin: false
# tags: [onedrive, sincronizacao]
# variaveis:
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

$exe = @("$env:ProgramFiles\Microsoft OneDrive\onedrive.exe", "${env:ProgramFiles(x86)}\Microsoft OneDrive\onedrive.exe", "$env:LOCALAPPDATA\Microsoft\OneDrive\onedrive.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $exe) { Write-Output "OneDrive não encontrado."; exit 1 }
Write-Output "OneDrive: $exe"
if (-not (Test-Confirmar)) { Write-Output "Defina CONFIRMAR=true para redefinir (a sincronização será refeita)."; exit 0 }
& $exe /reset
Start-Sleep 15
Start-Process $exe
Write-Output "Reset solicitado; o OneDrive será reiniciado."
exit 0
