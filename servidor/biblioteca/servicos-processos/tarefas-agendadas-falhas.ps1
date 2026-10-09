# ---
# id: tarefas-agendadas-falhas
# nome: "Tarefas agendadas com falha"
# descricao: "Lista tarefas agendadas cujo último resultado foi diferente de sucesso."
# categoria: Serviços e processos
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 120
# requer_admin: false
# tags: [tarefas, agendador]
# variaveis:
#   - nome: SAIDA
#     rotulo: "Formato de saída"
#     tipo: selecao
#     padrao: "texto"
#     obrigatorio: false
#     opcoes: [texto, json]
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function Out-Dados($d) { if ("$env:FAROL_SAIDA" -eq 'json') { $d | ConvertTo-Json -Depth 4 } else { ($d | Format-Table -AutoSize | Out-String -Width 220).TrimEnd() } }

$d = Get-ScheduledTask | Where-Object State -ne 'Disabled' | ForEach-Object {
  $i = $_ | Get-ScheduledTaskInfo -ErrorAction SilentlyContinue
  if ($i -and $i.LastTaskResult -notin 0, 267009, 267011, 267014, 267008 -and $i.LastRunTime -gt (Get-Date).AddYears(-1)) {
    [pscustomobject]@{ Tarefa = "$($_.TaskPath)$($_.TaskName)"; UltimaExecucao = $i.LastRunTime; Resultado = ('0x{0:X}' -f $i.LastTaskResult) }
  }
}
if (-not $d) { Write-Output "Nenhuma tarefa com falha."; exit 0 }
Out-Dados $d
exit 0
