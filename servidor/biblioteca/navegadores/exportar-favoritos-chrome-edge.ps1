# ---
# id: exportar-favoritos-chrome-edge
# nome: "Exportar favoritos do Chrome e Edge"
# descricao: "Copia os arquivos Bookmarks de todos os perfis para uma pasta de backup identificada pelo usuário e data."
# categoria: Navegadores
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 60
# requer_admin: false
# tags: [favoritos, backup]
# variaveis:
#   - nome: DESTINO
#     rotulo: "Pasta de destino"
#     tipo: texto
#     padrao: ""
#     obrigatorio: true
#     opcoes: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

$d = "$env:FAROL_DESTINO".Trim()
if (-not $d) { Write-Output "Informe DESTINO."; exit 1 }
New-Item $d -ItemType Directory -Force | Out-Null
$n = 0
foreach ($par in @(@('Chrome', "$env:LOCALAPPDATA\Google\Chrome\User Data"), @('Edge', "$env:LOCALAPPDATA\Microsoft\Edge\User Data"))) {
  if (-not (Test-Path $par[1])) { continue }
  Get-ChildItem $par[1] -Directory | Where-Object { $_.Name -match '^(Default|Profile \d+)$' } | ForEach-Object {
    $f = Join-Path $_.FullName 'Bookmarks'
    if (Test-Path $f) { Copy-Item $f (Join-Path $d "$($par[0])-$($env:USERNAME)-$($_.Name -replace ' ','')-Bookmarks-$(Get-Date -Format yyyyMMdd).json") -Force; $n++ }
  }
}
Write-Output "$n arquivo(s) de favoritos copiado(s) para $d"
exit 0
