# ---
# id: historico-atualizacoes-windows
# nome: "Histórico de atualizações instaladas"
# descricao: "Lista as últimas atualizações do Windows instaladas (hotfixes) com data e KB."
# categoria: Atualizações
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 120
# requer_admin: false
# tags: [hotfix, historico]
# variaveis:
#   - nome: TOP
#     rotulo: "Quantidade"
#     tipo: numero
#     padrao: 30
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

$top = Get-Num $env:FAROL_TOP 30
$d = Get-HotFix | Sort-Object InstalledOn -Descending | Select-Object -First $top HotFixID, Description, InstalledOn, InstalledBy
Out-Dados $d
exit 0
