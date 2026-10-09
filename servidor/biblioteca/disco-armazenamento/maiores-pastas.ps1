# ---
# id: maiores-pastas
# nome: "Maiores pastas de um caminho"
# descricao: "Calcula o tamanho das subpastas imediatas de um diretório e lista as maiores, para achar o que está consumindo disco."
# categoria: Disco e armazenamento
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 600
# requer_admin: false
# tags: [disco, espaco, pastas]
# variaveis:
#   - nome: CAMINHO
#     rotulo: "Caminho a analisar"
#     tipo: texto
#     padrao: "C:\\"
#     obrigatorio: false
#     opcoes: []
#   - nome: TOP
#     rotulo: "Quantidade de itens"
#     tipo: numero
#     padrao: 15
#     obrigatorio: false
#     opcoes: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function Get-Num($v, $padrao) { if ("$v" -match '^\d+$') { [int]$v } else { $padrao } }
function Format-Tam($b) { if ($b -ge 1GB) { '{0:N2} GB' -f ($b / 1GB) } elseif ($b -ge 1MB) { '{0:N1} MB' -f ($b / 1MB) } else { '{0:N0} KB' -f ($b / 1KB) } }

$cam = if ($env:FAROL_CAMINHO) { $env:FAROL_CAMINHO } else { 'C:\' }
$top = Get-Num $env:FAROL_TOP 15
if (-not (Test-Path -LiteralPath $cam)) { Write-Output "Caminho não encontrado: $cam"; exit 1 }
Get-ChildItem -LiteralPath $cam -Directory -Force -ErrorAction SilentlyContinue | ForEach-Object {
  $t = (Get-ChildItem -LiteralPath $_.FullName -Recurse -Force -File -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum
  [pscustomobject]@{ Pasta = $_.FullName; Tamanho = [int64]$t; Legivel = (Format-Tam ([int64]$t)) }
} | Sort-Object Tamanho -Descending | Select-Object -First $top Legivel, Pasta | Format-Table -AutoSize | Out-String -Width 200 | Write-Output
exit 0
