# ---
# id: reiniciar-agente-em-n-minutos
# nome: "Executar comando após atraso (agendado único)"
# descricao: "Cria uma tarefa agendada de uma execução única (SYSTEM) que roda um comando PowerShell após N minutos e se autoexclui."
# categoria: Utilitários
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 60
# requer_admin: true
# tags: [agendamento, automacao]
# variaveis:
#   - nome: COMANDO
#     rotulo: "Comando PowerShell"
#     tipo: texto
#     padrao: ""
#     obrigatorio: true
#     opcoes: []
#   - nome: MINUTOS
#     rotulo: "Executar em (min)"
#     tipo: numero
#     padrao: 5
#     obrigatorio: false
#     opcoes: []
#   - nome: CONFIRMAR
#     rotulo: "Digite true para confirmar a execução"
#     tipo: booleano
#     padrao: false
#     obrigatorio: false
#     opcoes: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function Get-Num($v, $padrao) { if ("$v" -match '^\d+$') { [int]$v } else { $padrao } }
function Test-Admin { ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator) }
function Exigir-Admin { if (-not (Test-Admin)) { Write-Output 'ERRO: este script precisa ser executado como administrador.'; exit 1 } }
function Test-Confirmar { "$env:FAROL_CONFIRMAR" -match '^(1|true|sim|s|yes|y|verdadeiro)$' }

Exigir-Admin
$c = "$env:FAROL_COMANDO"; $m = Get-Num $env:FAROL_MINUTOS 5
if (-not $c.Trim()) { Write-Output "Informe COMANDO."; exit 1 }
if (-not (Test-Confirmar)) { Write-Output "Agendaria em $m min: $c`nDefina CONFIRMAR=true."; exit 0 }
$enc = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($c))
$n = "FarolUnico-" + [guid]::NewGuid().ToString('N').Substring(0, 8)
$a = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -ExecutionPolicy Bypass -EncodedCommand $enc"
$t = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes($m)
$s = New-ScheduledTaskSettingsSet -DeleteExpiredTaskAfter (New-TimeSpan -Minutes 5)
$t.EndBoundary = (Get-Date).AddMinutes($m + 2).ToString('s')
Register-ScheduledTask -TaskName $n -Action $a -Trigger $t -Settings $s -User 'SYSTEM' -RunLevel Highest | Out-Null
Write-Output "Tarefa '$n' agendada para daqui a $m minuto(s)."
exit 0
