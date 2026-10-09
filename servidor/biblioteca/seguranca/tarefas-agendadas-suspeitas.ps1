# ---
# id: tarefas-agendadas-suspeitas
# nome: "Tarefas agendadas fora do padrão"
# descricao: "Lista tarefas agendadas não-Microsoft ou que executam binários em pastas de usuário/temporárias, comuns em malware."
# categoria: Segurança
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 120
# requer_admin: false
# tags: [tarefas, malware, persistencia]
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

$d = Get-ScheduledTask -ErrorAction SilentlyContinue | Where-Object { $_.State -ne 'Disabled' } | ForEach-Object {
  $a = $_.Actions | Select-Object -First 1
  $exe = "$($a.Execute) $($a.Arguments)"
  $susp = $exe -match 'AppData|\\Temp\\|\\Users\\Public|powershell.*-(enc|e |w hidden)|mshta|wscript|regsvr32|rundll32.*http|bitsadmin|certutil.*-urlcache'
  if ($_.TaskPath -notlike '\Microsoft\*' -or $susp) {
    [pscustomobject]@{ Tarefa = "$($_.TaskPath)$($_.TaskName)"; Usuario = $_.Principal.UserId; Suspeita = $susp; Comando = $exe.Trim() }
  }
}
if (-not $d) { Write-Output "Nenhuma tarefa fora do padrão."; exit 0 }
Out-Dados ($d | Sort-Object Suspeita -Descending)
exit 0
