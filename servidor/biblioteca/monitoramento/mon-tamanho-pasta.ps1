# ---
# id: mon-tamanho-pasta
# nome: "Monitor - tamanho de uma pasta"
# descricao: "Calcula o tamanho de uma pasta e alerta ao ultrapassar limites (GB). Bom para logs, bancos de dados e caixas de e-mail."
# categoria: Monitoramento
# so: [windows]
# shell: powershell
# tipo: monitor
# tempo_limite: 300
# requer_admin: false
# tags: [pasta, capacidade, monitor]
# variaveis:
#   - nome: CAMINHO
#     rotulo: "Pasta"
#     tipo: texto
#     padrao: ""
#     obrigatorio: true
#     opcoes: []
#   - nome: ALERTA_GB
#     rotulo: "Alerta (GB)"
#     tipo: numero
#     padrao: 10
#     obrigatorio: false
#     opcoes: []
#   - nome: CRITICO_GB
#     rotulo: "Crítico (GB)"
#     tipo: numero
#     padrao: 20
#     obrigatorio: false
#     opcoes: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function Get-Num($v, $padrao) { if ("$v" -match '^\d+$') { [int]$v } else { $padrao } }
function Out-Status($nivel, $msg) { Write-Output "FAROL_STATUS: $nivel $msg" }

$p = "$env:FAROL_CAMINHO".Trim(); $a = Get-Num $env:FAROL_ALERTA_GB 10; $c = Get-Num $env:FAROL_CRITICO_GB 20
if (-not (Test-Path -LiteralPath $p)) { Out-Status 'alerta' "Pasta inexistente: $p"; exit 0 }
$gb = [math]::Round(((Get-ChildItem -LiteralPath $p -Recurse -File -Force -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum) / 1GB, 2)
$msg = "$p ocupa $gb GB"
if ($gb -ge $c) { Out-Status 'critico' $msg } elseif ($gb -ge $a) { Out-Status 'alerta' $msg } else { Out-Status 'ok' $msg }
exit 0
