# ---
# id: verificar-throttling-processos-rede
# nome: "Verificar tempo de execução de processos de longa duração"
# descricao: "Lista processos há muito tempo em execução com crescimento de memória, para detectar vazamentos."
# categoria: Desempenho
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 120
# requer_admin: false
# tags: [vazamento, memoria]
# variaveis:
#   - nome: HORAS
#     rotulo: "Executando há mais de (horas)"
#     tipo: numero
#     padrao: 72
#     obrigatorio: false
#     opcoes: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function Get-Num($v, $padrao) { if ("$v" -match '^\d+$') { [int]$v } else { $padrao } }

$h = Get-Num $env:FAROL_HORAS 72
Get-Process | Where-Object { $_.StartTime -and $_.StartTime -lt (Get-Date).AddHours(-$h) -and $_.WorkingSet64 -gt 200MB } | Sort-Object WorkingSet64 -Descending | Select-Object -First 15 Name, Id, @{n='MemMB';e={[int]($_.WorkingSet64/1MB)}}, @{n='Handles';e={$_.HandleCount}}, @{n='Horas';e={[int]((Get-Date) - $_.StartTime).TotalHours}} | Format-Table -AutoSize | Out-String | Write-Output
exit 0
