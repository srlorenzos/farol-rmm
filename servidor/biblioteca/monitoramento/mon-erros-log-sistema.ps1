# ---
# id: mon-erros-log-sistema
# nome: "Monitor - erros críticos no log do Sistema"
# descricao: "Conta eventos de nível Crítico/Erro no log System nas últimas N horas."
# categoria: Monitoramento
# so: [windows]
# shell: powershell
# tipo: monitor
# tempo_limite: 60
# requer_admin: false
# tags: [eventos, estabilidade, monitor]
# variaveis:
#   - nome: HORAS
#     rotulo: "Janela (horas)"
#     tipo: numero
#     padrao: 24
#     obrigatorio: false
#     opcoes: []
#   - nome: ALERTA
#     rotulo: "Alerta (qtde)"
#     tipo: numero
#     padrao: 25
#     obrigatorio: false
#     opcoes: []
#   - nome: CRITICO
#     rotulo: "Crítico (qtde)"
#     tipo: numero
#     padrao: 100
#     obrigatorio: false
#     opcoes: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function Get-Num($v, $padrao) { if ("$v" -match '^\d+$') { [int]$v } else { $padrao } }
function Out-Status($nivel, $msg) { Write-Output "FAROL_STATUS: $nivel $msg" }

$h = Get-Num $env:FAROL_HORAS 24; $a = Get-Num $env:FAROL_ALERTA 25; $c = Get-Num $env:FAROL_CRITICO 100
$e = @(Get-WinEvent -FilterHashtable @{ LogName = 'System'; Level = 1, 2; StartTime = (Get-Date).AddHours(-$h) } -ErrorAction SilentlyContinue)
$top = ($e | Group-Object ProviderName | Sort-Object Count -Descending | Select-Object -First 2 | ForEach-Object { "$($_.Name)=$($_.Count)" }) -join ', '
$msg = "$($e.Count) erro(s) em ${h}h" + $(if ($top) { " ($top)" })
if ($e.Count -ge $c) { Out-Status 'critico' $msg } elseif ($e.Count -ge $a) { Out-Status 'alerta' $msg } else { Out-Status 'ok' $msg }
exit 0
