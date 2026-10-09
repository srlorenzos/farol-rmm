# ---
# id: limpar-cache-navegadores
# nome: "Limpar cache dos navegadores"
# descricao: "Limpa o cache (não senhas nem favoritos) do Chrome, Edge, Firefox e Brave para todos os perfis do usuário atual. Fecha os navegadores."
# categoria: Navegadores
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 300
# requer_admin: false
# tags: [navegadores, cache]
# variaveis:
#   - nome: NAVEGADORES
#     rotulo: "Navegadores (chrome,edge,firefox,brave)"
#     tipo: texto
#     padrao: "chrome,edge,firefox,brave"
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

if (-not (Test-Confirmar)) { Write-Output "Defina CONFIRMAR=true (os navegadores serão fechados)."; exit 0 }
$sel = ("$env:FAROL_NAVEGADORES" -replace '\s', '').ToLower().Split(',')
if (-not $env:FAROL_NAVEGADORES) { $sel = 'chrome', 'edge', 'firefox', 'brave' }
$map = @{ chrome = "$env:LOCALAPPDATA\Google\Chrome\User Data"; edge = "$env:LOCALAPPDATA\Microsoft\Edge\User Data"; brave = "$env:LOCALAPPDATA\BraveSoftware\Brave-Browser\User Data" }
$proc = @{ chrome = 'chrome'; edge = 'msedge'; brave = 'brave'; firefox = 'firefox' }
foreach ($b in $sel) {
  if ($proc.ContainsKey($b)) { Get-Process $proc[$b] -ErrorAction SilentlyContinue | Stop-Process -Force }
  if ($map.ContainsKey($b) -and (Test-Path $map[$b])) {
    Get-ChildItem $map[$b] -Directory | Where-Object { $_.Name -match '^(Default|Profile \d+)$' } | ForEach-Object {
      foreach ($c in 'Cache', 'Code Cache', 'GPUCache', 'Service Worker\CacheStorage') { $p = Join-Path $_.FullName $c; if (Test-Path $p) { Remove-Item $p -Recurse -Force -ErrorAction SilentlyContinue } }
    }
    Write-Output "Cache do $b limpo."
  }
  if ($b -eq 'firefox') {
    Get-ChildItem "$env:LOCALAPPDATA\Mozilla\Firefox\Profiles" -Directory -ErrorAction SilentlyContinue | ForEach-Object { Remove-Item "$($_.FullName)\cache2" -Recurse -Force -ErrorAction SilentlyContinue }
    Write-Output "Cache do firefox limpo."
  }
}
exit 0
