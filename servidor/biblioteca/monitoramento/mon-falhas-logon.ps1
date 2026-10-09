# ---
# id: mon-falhas-logon
# nome: "Monitor - falhas de logon (força bruta)"
# descricao: "Conta eventos 4625 na última hora e alerta acima dos limites."
# categoria: Monitoramento
# so: [windows]
# shell: powershell
# tipo: monitor
# tempo_limite: 60
# requer_admin: true
# tags: [seguranca, logon, monitor]
# variaveis:
#   - nome: ALERTA
#     rotulo: "Alerta (falhas/hora)"
#     tipo: numero
#     padrao: 20
#     obrigatorio: false
#     opcoes: []
#   - nome: CRITICO
#     rotulo: "Crítico (falhas/hora)"
#     tipo: numero
#     padrao: 100
#     obrigatorio: false
#     opcoes: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function Get-Num($v, $padrao) { if ("$v" -match '^\d+$') { [int]$v } else { $padrao } }
function Out-Status($nivel, $msg) { Write-Output "FAROL_STATUS: $nivel $msg" }

$a = Get-Num $env:FAROL_ALERTA 20; $c = Get-Num $env:FAROL_CRITICO 100
try { $n = @(Get-WinEvent -FilterHashtable @{ LogName = 'Security'; Id = 4625; StartTime = (Get-Date).AddHours(-1) } -ErrorAction Stop).Count } catch { if ($_.Exception.Message -match 'No events') { $n = 0 } else { Out-Status 'alerta' 'Sem acesso ao log Security'; exit 0 } }
$msg = "$n falha(s) de logon na última hora"
if ($n -ge $c) { Out-Status 'critico' $msg } elseif ($n -ge $a) { Out-Status 'alerta' $msg } else { Out-Status 'ok' $msg }
exit 0
