# ---
# id: localizar-arquivos-por-extensao
# nome: "Localizar arquivos por extensão"
# descricao: "Busca arquivos com determinadas extensões (ex.: pst,ost,mp4,iso) e soma o espaço ocupado. Apenas relatório."
# categoria: Disco e armazenamento
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 900
# requer_admin: false
# tags: [busca, extensoes]
# variaveis:
#   - nome: CAMINHO
#     rotulo: "Caminho"
#     tipo: texto
#     padrao: "C:\\Users"
#     obrigatorio: false
#     opcoes: []
#   - nome: EXTENSOES
#     rotulo: "Extensões separadas por vírgula"
#     tipo: texto
#     padrao: "pst,ost,iso,mp4"
#     obrigatorio: false
#     opcoes: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function Format-Tam($b) { if ($b -ge 1GB) { '{0:N2} GB' -f ($b / 1GB) } elseif ($b -ge 1MB) { '{0:N1} MB' -f ($b / 1MB) } else { '{0:N0} KB' -f ($b / 1KB) } }

$cam = if ($env:FAROL_CAMINHO) { $env:FAROL_CAMINHO } else { 'C:\Users' }
$ext = if ($env:FAROL_EXTENSOES) { $env:FAROL_EXTENSOES } else { 'pst,ost,iso,mp4' }
$f = $ext.Split(',') | ForEach-Object { $e = $_.Trim().TrimStart('.'); if ($e -match '^[A-Za-z0-9]{1,10}$') { "*.$e" } }
if (-not $f) { Write-Output "Nenhuma extensão válida."; exit 1 }
$r = Get-ChildItem -LiteralPath $cam -Recurse -Force -File -Include $f -ErrorAction SilentlyContinue
$r | Sort-Object Length -Descending | Select-Object -First 50 | ForEach-Object { [pscustomobject]@{ Tamanho = Format-Tam $_.Length; Arquivo = $_.FullName } } | Format-Table -AutoSize | Out-String -Width 250 | Write-Output
Write-Output ("{0} arquivo(s), {1} no total." -f @($r).Count, (Format-Tam ([int64](($r | Measure-Object Length -Sum).Sum))))
exit 0
