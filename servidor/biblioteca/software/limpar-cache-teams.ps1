# ---
# id: limpar-cache-teams
# nome: "Limpar cache do Microsoft Teams"
# descricao: "Fecha o Teams (clássico e novo) e apaga o cache local para resolver travamentos, avatares e mensagens que não carregam."
# categoria: Software
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 120
# requer_admin: false
# tags: [teams, cache]
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

if (-not (Test-Confirmar)) { Write-Output "Defina CONFIRMAR=true (o Teams será fechado)."; exit 0 }
Get-Process Teams, ms-teams, msedgewebview2 -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep 2
$alvos = "$env:APPDATA\Microsoft\Teams", "$env:LOCALAPPDATA\Packages\MSTeams_8wekyb3d8bbwe\LocalCache\Microsoft\MSTeams"
foreach ($a in $alvos) {
  if (Test-Path $a) {
    foreach ($s in 'Cache', 'blob_storage', 'Code Cache', 'GPUCache', 'IndexedDB', 'Local Storage', 'tmp', 'EBWebView') { $p = Join-Path $a $s; if (Test-Path $p) { Remove-Item $p -Recurse -Force -ErrorAction SilentlyContinue } }
    Write-Output "Cache limpo em $a"
  }
}
exit 0
