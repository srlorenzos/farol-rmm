# ---
# id: criar-tarefa-agendada-script
# nome: "Criar tarefa agendada diária"
# descricao: "Cria (ou recria) uma tarefa agendada diária como SYSTEM que executa um comando PowerShell informado. Idempotente por nome."
# categoria: Serviços e processos
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 60
# requer_admin: true
# tags: [tarefas, agendador, automacao]
# variaveis:
#   - nome: NOME
#     rotulo: "Nome da tarefa"
#     tipo: texto
#     padrao: ""
#     obrigatorio: true
#     opcoes: []
#   - nome: COMANDO
#     rotulo: "Comando PowerShell a executar"
#     tipo: texto
#     padrao: ""
#     obrigatorio: true
#     opcoes: []
#   - nome: HORA
#     rotulo: "Horário (HH:mm)"
#     tipo: texto
#     padrao: "03:00"
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
function Test-Admin { ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator) }
function Exigir-Admin { if (-not (Test-Admin)) { Write-Output 'ERRO: este script precisa ser executado como administrador.'; exit 1 } }
function Test-Confirmar { "$env:FAROL_CONFIRMAR" -match '^(1|true|sim|s|yes|y|verdadeiro)$' }

Exigir-Admin
$n = "$env:FAROL_NOME".Trim(); $h = if ($env:FAROL_HORA -match '^\d{1,2}:\d{2}$') { $env:FAROL_HORA } else { '03:00' }
if ($n -notmatch '^[\w .-]+$' -or -not $env:FAROL_COMANDO) { Write-Output "Parâmetros inválidos."; exit 1 }
if (-not (Test-Confirmar)) { Write-Output "Criaria a tarefa '$n' às $h executando como SYSTEM: $env:FAROL_COMANDO`nDefina CONFIRMAR=true."; exit 0 }
$enc = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($env:FAROL_COMANDO))
$a = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -ExecutionPolicy Bypass -EncodedCommand $enc"
$t = New-ScheduledTaskTrigger -Daily -At $h
Register-ScheduledTask -TaskName $n -Action $a -Trigger $t -User 'SYSTEM' -RunLevel Highest -Force | Out-Null
Write-Output "Tarefa '$n' criada para $h diariamente."
exit 0
