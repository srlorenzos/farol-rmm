# ---
# id: mon-backup-arquivo-recente
# nome: "Monitor - backup recente em pasta ou arquivo"
# descricao: "Verifica se existe arquivo modificado nas últimas N horas dentro de uma pasta de backup (ou se o arquivo informado foi atualizado)."
# categoria: Monitoramento
# so: [windows]
# shell: powershell
# tipo: monitor
# tempo_limite: 60
# requer_admin: false
# tags: [backup, monitor]
# variaveis:
#   - nome: CAMINHO
#     rotulo: "Pasta ou arquivo de backup"
#     tipo: texto
#     padrao: ""
#     obrigatorio: true
#     opcoes: []
#   - nome: ALERTA_HORAS
#     rotulo: "Alerta (horas sem novo backup)"
#     tipo: numero
#     padrao: 26
#     obrigatorio: false
#     opcoes: []
#   - nome: CRITICO_HORAS
#     rotulo: "Crítico (horas)"
#     tipo: numero
#     padrao: 50
#     obrigatorio: false
#     opcoes: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function Get-Num($v, $padrao) { if ("$v" -match '^\d+$') { [int]$v } else { $padrao } }
function Out-Status($nivel, $msg) { Write-Output "FAROL_STATUS: $nivel $msg" }

$p = "$env:FAROL_CAMINHO".Trim()
$a = Get-Num $env:FAROL_ALERTA_HORAS 26; $c = Get-Num $env:FAROL_CRITICO_HORAS 50
if (-not (Test-Path -LiteralPath $p)) { Out-Status 'critico' "Caminho de backup inacessível: $p"; exit 0 }
$f = if ((Get-Item -LiteralPath $p).PSIsContainer) { Get-ChildItem -LiteralPath $p -Recurse -File -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1 } else { Get-Item -LiteralPath $p }
if (-not $f) { Out-Status 'critico' "Nenhum arquivo em $p"; exit 0 }
$h = [math]::Round(((Get-Date) - $f.LastWriteTime).TotalHours, 1)
$msg = "Último arquivo ($($f.Name)) há $h h"
if ($h -ge $c) { Out-Status 'critico' $msg } elseif ($h -ge $a) { Out-Status 'alerta' $msg } else { Out-Status 'ok' $msg }
exit 0
