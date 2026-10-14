# ---
# id: compactar-pasta-zip-backup
# nome: "Compactar pasta em ZIP com data"
# descricao: "Cria um arquivo ZIP datado de uma pasta e mantém apenas os N backups mais recentes no destino (rotação)."
# categoria: Backup e recuperação
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 3600
# requer_admin: false
# tags: [zip, backup, rotacao]
# variaveis:
#   - nome: ORIGEM
#     rotulo: "Pasta de origem"
#     tipo: texto
#     padrao: ""
#     obrigatorio: true
#     opcoes: []
#   - nome: DESTINO
#     rotulo: "Pasta de destino"
#     tipo: texto
#     padrao: ""
#     obrigatorio: true
#     opcoes: []
#   - nome: MANTER
#     rotulo: "Quantidade de backups a manter"
#     tipo: numero
#     padrao: 7
#     obrigatorio: false
#     opcoes: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function Get-Num($v, $padrao) { if ("$v" -match '^\d+$') { [int]$v } else { $padrao } }
function Format-Tam($b) { if ($b -ge 1GB) { '{0:N2} GB' -f ($b / 1GB) } elseif ($b -ge 1MB) { '{0:N1} MB' -f ($b / 1MB) } else { '{0:N0} KB' -f ($b / 1KB) } }

$o = "$env:FAROL_ORIGEM".Trim(); $d = "$env:FAROL_DESTINO".Trim(); $k = Get-Num $env:FAROL_MANTER 7
if (-not (Test-Path -LiteralPath $o -PathType Container)) { Write-Output "Origem inexistente."; exit 1 }
New-Item $d -ItemType Directory -Force | Out-Null
$nome = (Split-Path $o -Leaf) -replace '[^\w.-]', '_'
$z = Join-Path $d ("{0}-{1:yyyyMMdd-HHmm}.zip" -f $nome, (Get-Date))
Compress-Archive -Path (Join-Path $o '*') -DestinationPath $z -CompressionLevel Optimal
Write-Output ("Criado: {0} ({1})" -f $z, (Format-Tam (Get-Item $z).Length))
Get-ChildItem $d -Filter "$nome-*.zip" | Sort-Object LastWriteTime -Descending | Select-Object -Skip $k | ForEach-Object { Remove-Item $_.FullName -Force; Write-Output "Rotação: removido $($_.Name)" }
exit 0
