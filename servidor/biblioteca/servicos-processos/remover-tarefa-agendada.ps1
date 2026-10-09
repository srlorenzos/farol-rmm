# ---
# id: remover-tarefa-agendada
# nome: "Remover tarefa agendada"
# descricao: "Exclui uma tarefa agendada pelo nome, após exibir seus detalhes."
# categoria: Serviços e processos
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 60
# requer_admin: true
# tags: [tarefas, agendador]
# variaveis:
#   - nome: NOME
#     rotulo: "Nome da tarefa"
#     tipo: texto
#     padrao: ""
#     obrigatorio: true
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
$n = "$env:FAROL_NOME".Trim()
if ($n -notmatch '^[\w .-]+$') { Write-Output "Nome inválido."; exit 1 }
$t = Get-ScheduledTask -TaskName $n -ErrorAction SilentlyContinue
if (-not $t) { Write-Output "Tarefa não existe; nada a fazer."; exit 0 }
Write-Output "Tarefa: $($t.TaskPath)$($t.TaskName) ($($t.State))"
if (-not (Test-Confirmar)) { Write-Output "Defina CONFIRMAR=true para remover."; exit 0 }
Unregister-ScheduledTask -TaskName $n -Confirm:$false
Write-Output "Removida."
exit 0
