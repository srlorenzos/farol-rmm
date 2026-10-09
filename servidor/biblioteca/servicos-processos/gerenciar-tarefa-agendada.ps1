# ---
# id: gerenciar-tarefa-agendada
# nome: "Executar, habilitar ou desabilitar tarefa agendada"
# descricao: "Executa imediatamente, habilita ou desabilita uma tarefa agendada pelo nome."
# categoria: Serviços e processos
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 120
# requer_admin: true
# tags: [tarefas, agendador]
# variaveis:
#   - nome: TAREFA
#     rotulo: "Nome da tarefa"
#     tipo: texto
#     padrao: ""
#     obrigatorio: true
#     opcoes: []
#   - nome: ACAO
#     rotulo: "Ação"
#     tipo: selecao
#     padrao: "executar"
#     obrigatorio: true
#     opcoes: [executar, habilitar, desabilitar, status]
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function Test-Admin { ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator) }
function Exigir-Admin { if (-not (Test-Admin)) { Write-Output 'ERRO: este script precisa ser executado como administrador.'; exit 1 } }

Exigir-Admin
$n = "$env:FAROL_TAREFA".Trim()
if ($n -notmatch '^[\w .\\-]+$') { Write-Output "Nome inválido."; exit 1 }
$t = Get-ScheduledTask -TaskName ($n -replace '^.*\\') -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $t) { Write-Output "Tarefa não encontrada."; exit 1 }
switch ("$env:FAROL_ACAO") {
  'executar' { Start-ScheduledTask -InputObject $t }
  'habilitar' { Enable-ScheduledTask -InputObject $t | Out-Null }
  'desabilitar' { Disable-ScheduledTask -InputObject $t | Out-Null }
}
Get-ScheduledTask -TaskName $t.TaskName | Get-ScheduledTaskInfo | Format-List TaskName, LastRunTime, LastTaskResult, NextRunTime | Out-String | Write-Output
Write-Output ("Estado: " + (Get-ScheduledTask -TaskName $t.TaskName).State)
exit 0
