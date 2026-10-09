# ---
# id: mon-memoria-uso
# nome: "Monitor - uso de memória RAM"
# descricao: "Avalia o percentual de memória física em uso."
# categoria: Monitoramento
# so: [windows]
# shell: powershell
# tipo: monitor
# tempo_limite: 60
# requer_admin: false
# tags: [memoria, desempenho, monitor]
# variaveis:
#   - nome: ALERTA
#     rotulo: "Alerta (% em uso)"
#     tipo: numero
#     padrao: 85
#     obrigatorio: false
#     opcoes: []
#   - nome: CRITICO
#     rotulo: "Crítico (% em uso)"
#     tipo: numero
#     padrao: 95
#     obrigatorio: false
#     opcoes: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function Get-Num($v, $padrao) { if ("$v" -match '^\d+$') { [int]$v } else { $padrao } }
function Out-Status($nivel, $msg) { Write-Output "FAROL_STATUS: $nivel $msg" }

$a = Get-Num $env:FAROL_ALERTA 85; $c = Get-Num $env:FAROL_CRITICO 95
$o = Get-CimInstance Win32_OperatingSystem
$pct = [math]::Round(100 - ($o.FreePhysicalMemory / $o.TotalVisibleMemorySize * 100), 1)
$msg = "RAM $pct% em uso ($([math]::Round($o.FreePhysicalMemory/1MB,1)) GB livres de $([math]::Round($o.TotalVisibleMemorySize/1MB,1)) GB)"
if ($pct -ge $c) { Out-Status 'critico' $msg } elseif ($pct -ge $a) { Out-Status 'alerta' $msg } else { Out-Status 'ok' $msg }
exit 0
