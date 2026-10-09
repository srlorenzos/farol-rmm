# ---
# id: processos-maior-consumo
# nome: "Processos com maior consumo de CPU e memória"
# descricao: "Mostra os N processos que mais consomem memória e CPU acumulada, agrupados por nome."
# categoria: Serviços e processos
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 120
# requer_admin: false
# tags: [processos, desempenho]
# variaveis:
#   - nome: TOP
#     rotulo: "Quantidade"
#     tipo: numero
#     padrao: 15
#     obrigatorio: false
#     opcoes: []
#   - nome: SAIDA
#     rotulo: "Formato de saída"
#     tipo: selecao
#     padrao: "texto"
#     obrigatorio: false
#     opcoes: [texto, json]
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function Get-Num($v, $padrao) { if ("$v" -match '^\d+$') { [int]$v } else { $padrao } }
function Out-Dados($d) { if ("$env:FAROL_SAIDA" -eq 'json') { $d | ConvertTo-Json -Depth 4 } else { ($d | Format-Table -AutoSize | Out-String -Width 220).TrimEnd() } }

$top = Get-Num $env:FAROL_TOP 15
$d = Get-Process | Group-Object ProcessName | ForEach-Object {
  [pscustomobject]@{ Processo = $_.Name; Instancias = $_.Count; MemoriaMB = [math]::Round(($_.Group | Measure-Object WorkingSet64 -Sum).Sum / 1MB); CPUSeg = [math]::Round(($_.Group | Measure-Object CPU -Sum).Sum) }
} | Sort-Object MemoriaMB -Descending | Select-Object -First $top
Out-Dados $d
exit 0
