# ---
# id: mon-fila-impressao
# nome: "Monitor - trabalhos de impressão travados"
# descricao: "Alerta quando há trabalhos com erro ou muito antigos na fila de impressão."
# categoria: Monitoramento
# so: [windows]
# shell: powershell
# tipo: monitor
# tempo_limite: 60
# requer_admin: false
# tags: [impressoras, spooler, monitor]
# variaveis:
#   - nome: MINUTOS
#     rotulo: "Considerar travado após (min)"
#     tipo: numero
#     padrao: 30
#     obrigatorio: false
#     opcoes: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function Get-Num($v, $padrao) { if ("$v" -match '^\d+$') { [int]$v } else { $padrao } }
function Out-Status($nivel, $msg) { Write-Output "FAROL_STATUS: $nivel $msg" }

if ((Get-Service Spooler -ErrorAction SilentlyContinue).Status -ne 'Running') { Out-Status 'ok' 'Spooler parado (sem impressão)'; exit 0 }
$m = Get-Num $env:FAROL_MINUTOS 30
$j = @(Get-Printer -ErrorAction SilentlyContinue | ForEach-Object { Get-PrintJob -PrinterName $_.Name -ErrorAction SilentlyContinue } | Where-Object { $_.JobStatus -match 'Error|Offline|Paper' -or $_.SubmittedTime -lt (Get-Date).AddMinutes(-$m) })
if ($j.Count) { Out-Status 'alerta' "$($j.Count) trabalho(s) travado(s) na fila" } else { Out-Status 'ok' 'Fila de impressão normal' }
exit 0
