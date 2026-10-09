# ---
# id: mon-tarefa-agendada-resultado
# nome: "Monitor - resultado da última execução de tarefa agendada"
# descricao: "Verifica se uma tarefa agendada rodou com sucesso e dentro do prazo esperado."
# categoria: Monitoramento
# so: [windows]
# shell: powershell
# tipo: monitor
# tempo_limite: 60
# requer_admin: false
# tags: [tarefas, monitor]
# variaveis:
#   - nome: TAREFA
#     rotulo: "Nome da tarefa"
#     tipo: texto
#     padrao: ""
#     obrigatorio: true
#     opcoes: []
#   - nome: MAX_HORAS
#     rotulo: "Máx. horas desde a última execução"
#     tipo: numero
#     padrao: 26
#     obrigatorio: false
#     opcoes: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function Get-Num($v, $padrao) { if ("$v" -match '^\d+$') { [int]$v } else { $padrao } }
function Out-Status($nivel, $msg) { Write-Output "FAROL_STATUS: $nivel $msg" }

$n = "$env:FAROL_TAREFA".Trim()
if ($n -notmatch '^[\w .-]+$') { Write-Output "Nome inválido."; exit 2 }
$t = Get-ScheduledTask -TaskName $n -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $t) { Out-Status 'critico' "Tarefa '$n' não existe"; exit 0 }
$i = $t | Get-ScheduledTaskInfo
$h = [math]::Round(((Get-Date) - $i.LastRunTime).TotalHours, 1)
if ($i.LastTaskResult -ne 0) { Out-Status 'critico' ("Última execução falhou (0x{0:X})" -f $i.LastTaskResult) }
elseif ($h -gt (Get-Num $env:FAROL_MAX_HORAS 26)) { Out-Status 'alerta' "Última execução há $h h" }
else { Out-Status 'ok' "Executada há $h h com sucesso" }
exit 0
