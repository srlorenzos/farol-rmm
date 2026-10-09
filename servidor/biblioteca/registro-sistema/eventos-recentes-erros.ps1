# ---
# id: eventos-recentes-erros
# nome: "Eventos de erro e crítico recentes"
# descricao: "Lista os eventos de erro/crítico mais recentes de um log (System, Application, Security...) agrupados por origem e ID."
# categoria: Registro e logs do sistema
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 120
# requer_admin: false
# tags: [eventos, logs]
# variaveis:
#   - nome: LOG
#     rotulo: "Log"
#     tipo: selecao
#     padrao: "System"
#     obrigatorio: false
#     opcoes: [System, Application, Setup]
#   - nome: HORAS
#     rotulo: "Janela (horas)"
#     tipo: numero
#     padrao: 24
#     obrigatorio: false
#     opcoes: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function Get-Num($v, $padrao) { if ("$v" -match '^\d+$') { [int]$v } else { $padrao } }

$log = if ("$env:FAROL_LOG" -in 'System', 'Application', 'Setup') { $env:FAROL_LOG } else { 'System' }
$h = Get-Num $env:FAROL_HORAS 24
$e = Get-WinEvent -FilterHashtable @{ LogName = $log; Level = 1, 2; StartTime = (Get-Date).AddHours(-$h) } -ErrorAction SilentlyContinue
if (-not $e) { Write-Output "Sem erros em $log nas últimas ${h}h."; exit 0 }
$e | Group-Object ProviderName, Id | Sort-Object Count -Descending | Select-Object -First 20 Count, Name | Format-Table -AutoSize | Out-String | Write-Output
Write-Output "-- Mais recentes --"
$e | Select-Object -First 5 | ForEach-Object { Write-Output ("{0} [{1}] {2}" -f $_.TimeCreated.ToString('MM-dd HH:mm'), $_.Id, (($_.Message -split "`n")[0])) }
exit 0
