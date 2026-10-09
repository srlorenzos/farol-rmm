# ---
# id: mon-tamanho-lixeira-temp
# nome: "Monitor - acúmulo de temporários"
# descricao: "Mede o tamanho de C:\\Windows\\Temp e dos temporários de usuários e alerta quando excede o limite."
# categoria: Monitoramento
# so: [windows]
# shell: powershell
# tipo: monitor
# tempo_limite: 300
# requer_admin: false
# tags: [temp, disco, monitor]
# variaveis:
#   - nome: ALERTA_GB
#     rotulo: "Alerta (GB)"
#     tipo: numero
#     padrao: 5
#     obrigatorio: false
#     opcoes: []
#   - nome: CRITICO_GB
#     rotulo: "Crítico (GB)"
#     tipo: numero
#     padrao: 15
#     obrigatorio: false
#     opcoes: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function Get-Num($v, $padrao) { if ("$v" -match '^\d+$') { [int]$v } else { $padrao } }
function Out-Status($nivel, $msg) { Write-Output "FAROL_STATUS: $nivel $msg" }

$a = Get-Num $env:FAROL_ALERTA_GB 5; $c = Get-Num $env:FAROL_CRITICO_GB 15
$t = 0
foreach ($p in "$env:windir\Temp") { $t += [int64](Get-ChildItem $p -Recurse -File -Force -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum }
Get-ChildItem 'C:\Users' -Directory -ErrorAction SilentlyContinue | ForEach-Object { $t += [int64](Get-ChildItem "$($_.FullName)\AppData\Local\Temp" -Recurse -File -Force -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum }
$gb = [math]::Round($t / 1GB, 2); $msg = "Temporários somam $gb GB"
if ($gb -ge $c) { Out-Status 'critico' $msg } elseif ($gb -ge $a) { Out-Status 'alerta' $msg } else { Out-Status 'ok' $msg }
exit 0
