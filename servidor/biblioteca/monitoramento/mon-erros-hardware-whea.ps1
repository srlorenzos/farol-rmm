# ---
# id: mon-erros-hardware-whea
# nome: "Monitor - erros de hardware (WHEA)"
# descricao: "Detecta eventos WHEA-Logger (erros de CPU, memória, PCIe) que indicam hardware defeituoso."
# categoria: Monitoramento
# so: [windows]
# shell: powershell
# tipo: monitor
# tempo_limite: 60
# requer_admin: false
# tags: [hardware, whea, monitor]
# variaveis:
#   - nome: DIAS
#     rotulo: "Janela (dias)"
#     tipo: numero
#     padrao: 14
#     obrigatorio: false
#     opcoes: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function Get-Num($v, $padrao) { if ("$v" -match '^\d+$') { [int]$v } else { $padrao } }
function Out-Status($nivel, $msg) { Write-Output "FAROL_STATUS: $nivel $msg" }

$d = Get-Num $env:FAROL_DIAS 14
$e = @(Get-WinEvent -FilterHashtable @{ LogName = 'System'; ProviderName = 'Microsoft-Windows-WHEA-Logger'; StartTime = (Get-Date).AddDays(-$d) } -ErrorAction SilentlyContinue)
if ($e.Count -ge 3) { Out-Status 'critico' "$($e.Count) evento(s) WHEA em ${d}d" } elseif ($e.Count) { Out-Status 'alerta' "$($e.Count) evento(s) WHEA em ${d}d" } else { Out-Status 'ok' 'Sem erros WHEA' }
exit 0
