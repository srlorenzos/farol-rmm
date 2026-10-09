# ---
# id: mon-uptime-longo
# nome: "Monitor - tempo ligado sem reiniciar"
# descricao: "Alerta quando o computador está há muitos dias sem reiniciar (patches pendentes, vazamentos de memória)."
# categoria: Monitoramento
# so: [windows]
# shell: powershell
# tipo: monitor
# tempo_limite: 60
# requer_admin: false
# tags: [uptime, reinicio, monitor]
# variaveis:
#   - nome: ALERTA
#     rotulo: "Alerta (dias)"
#     tipo: numero
#     padrao: 30
#     obrigatorio: false
#     opcoes: []
#   - nome: CRITICO
#     rotulo: "Crítico (dias)"
#     tipo: numero
#     padrao: 60
#     obrigatorio: false
#     opcoes: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function Get-Num($v, $padrao) { if ("$v" -match '^\d+$') { [int]$v } else { $padrao } }
function Out-Status($nivel, $msg) { Write-Output "FAROL_STATUS: $nivel $msg" }

$a = Get-Num $env:FAROL_ALERTA 30; $c = Get-Num $env:FAROL_CRITICO 60
$d = [math]::Round(((Get-Date) - (Get-CimInstance Win32_OperatingSystem).LastBootUpTime).TotalDays, 1)
$msg = "Ligado há $d dia(s)"
if ($d -ge $c) { Out-Status 'critico' $msg } elseif ($d -ge $a) { Out-Status 'alerta' $msg } else { Out-Status 'ok' $msg }
exit 0
