# ---
# id: arquivos-duplicados
# nome: "Localizar arquivos duplicados"
# descricao: "Encontra arquivos duplicados (mesmo tamanho e hash SHA-256) em uma pasta e informa o espaço desperdiçado. Apenas relatório."
# categoria: Disco e armazenamento
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 1800
# requer_admin: false
# tags: [disco, duplicados, hash]
# variaveis:
#   - nome: CAMINHO
#     rotulo: "Pasta a analisar"
#     tipo: texto
#     padrao: "C:\\Users"
#     obrigatorio: false
#     opcoes: []
#   - nome: MIN_MB
#     rotulo: "Tamanho mínimo (MB)"
#     tipo: numero
#     padrao: 10
#     obrigatorio: false
#     opcoes: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function Get-Num($v, $padrao) { if ("$v" -match '^\d+$') { [int]$v } else { $padrao } }
function Format-Tam($b) { if ($b -ge 1GB) { '{0:N2} GB' -f ($b / 1GB) } elseif ($b -ge 1MB) { '{0:N1} MB' -f ($b / 1MB) } else { '{0:N0} KB' -f ($b / 1KB) } }

$cam = if ($env:FAROL_CAMINHO) { $env:FAROL_CAMINHO } else { 'C:\Users' }
$min = (Get-Num $env:FAROL_MIN_MB 10) * 1MB
if (-not (Test-Path -LiteralPath $cam)) { Write-Output "Caminho não encontrado: $cam"; exit 1 }
$arqs = Get-ChildItem -LiteralPath $cam -Recurse -Force -File -ErrorAction SilentlyContinue | Where-Object { $_.Length -ge $min }
$grupos = $arqs | Group-Object Length | Where-Object { $_.Count -gt 1 }
$desp = 0; $achou = 0
foreach ($g in $grupos) {
  $h = $g.Group | ForEach-Object { [pscustomobject]@{ F = $_; H = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256 -ErrorAction SilentlyContinue).Hash } } | Where-Object { $_.H } | Group-Object H | Where-Object { $_.Count -gt 1 }
  foreach ($x in $h) {
    $achou++; $desp += $x.Group[0].F.Length * ($x.Count - 1)
    Write-Output ("Duplicados ({0}):" -f (Format-Tam $x.Group[0].F.Length))
    $x.Group | ForEach-Object { Write-Output ("  " + $_.F.FullName) }
  }
}
Write-Output ("Grupos de duplicados: {0}; espaço desperdiçado: {1}" -f $achou, (Format-Tam $desp))
exit 0
