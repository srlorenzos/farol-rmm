# ---
# id: tamanho-ost-pst-usuarios
# nome: "Tamanho dos arquivos OST/PST de todos os usuários"
# descricao: "Varre os perfis em C:\\Users e lista OST/PST grandes, que causam lentidão e consumo de disco."
# categoria: E-mail e Outlook
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 600
# requer_admin: false
# tags: [outlook, ost, pst]
# variaveis:
#   - nome: MIN_GB
#     rotulo: "Tamanho mínimo (GB)"
#     tipo: numero
#     padrao: 2
#     obrigatorio: false
#     opcoes: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function Get-Num($v, $padrao) { if ("$v" -match '^\d+$') { [int]$v } else { $padrao } }
function Format-Tam($b) { if ($b -ge 1GB) { '{0:N2} GB' -f ($b / 1GB) } elseif ($b -ge 1MB) { '{0:N1} MB' -f ($b / 1MB) } else { '{0:N0} KB' -f ($b / 1KB) } }

$min = (Get-Num $env:FAROL_MIN_GB 2) * 1GB
$r = Get-ChildItem 'C:\Users' -Include *.ost, *.pst -Recurse -Force -ErrorAction SilentlyContinue | Where-Object { $_.Length -ge $min } | Sort-Object Length -Descending
if (-not $r) { Write-Output "Nenhum OST/PST acima de $($min/1GB) GB."; exit 0 }
$r | ForEach-Object { [pscustomobject]@{ Tamanho = Format-Tam $_.Length; Modificado = $_.LastWriteTime.ToString('yyyy-MM-dd'); Arquivo = $_.FullName } } | Format-Table -AutoSize | Out-String -Width 220 | Write-Output
exit 0
