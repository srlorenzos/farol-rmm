# ---
# id: arquivos-grandes-antigos
# nome: "Arquivos grandes sem acesso recente"
# descricao: "Lista arquivos grandes que não são acessados há muito tempo, candidatos a arquivamento."
# categoria: Disco e armazenamento
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 900
# requer_admin: false
# tags: [arquivamento, espaco]
# variaveis:
#   - nome: CAMINHO
#     rotulo: "Caminho"
#     tipo: texto
#     padrao: "D:\\"
#     obrigatorio: false
#     opcoes: []
#   - nome: DIAS
#     rotulo: "Sem acesso há (dias)"
#     tipo: numero
#     padrao: 365
#     obrigatorio: false
#     opcoes: []
#   - nome: MIN_MB
#     rotulo: "Tamanho mínimo (MB)"
#     tipo: numero
#     padrao: 100
#     obrigatorio: false
#     opcoes: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function Get-Num($v, $padrao) { if ("$v" -match '^\d+$') { [int]$v } else { $padrao } }
function Format-Tam($b) { if ($b -ge 1GB) { '{0:N2} GB' -f ($b / 1GB) } elseif ($b -ge 1MB) { '{0:N1} MB' -f ($b / 1MB) } else { '{0:N0} KB' -f ($b / 1KB) } }

$cam = if ($env:FAROL_CAMINHO) { $env:FAROL_CAMINHO } else { 'D:\' }
$lim = (Get-Date).AddDays(-(Get-Num $env:FAROL_DIAS 365))
$min = (Get-Num $env:FAROL_MIN_MB 100) * 1MB
if (-not (Test-Path -LiteralPath $cam)) { Write-Output "Caminho não encontrado: $cam"; exit 1 }
$r = Get-ChildItem -LiteralPath $cam -Recurse -Force -File -ErrorAction SilentlyContinue | Where-Object { $_.Length -ge $min -and $_.LastWriteTime -lt $lim } | Sort-Object Length -Descending | Select-Object -First 30
$r | ForEach-Object { [pscustomobject]@{ Tamanho = Format-Tam $_.Length; Modificado = $_.LastWriteTime.ToString('yyyy-MM-dd'); Arquivo = $_.FullName } } | Format-Table -AutoSize | Out-String -Width 250 | Write-Output
Write-Output ("Total listado: {0}" -f (Format-Tam ([int64](($r | Measure-Object Length -Sum).Sum))))
exit 0
