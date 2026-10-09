# ---
# id: mon-windows-update-idade
# nome: "Monitor - tempo desde a última atualização instalada"
# descricao: "Alerta quando o último patch do Windows instalado é muito antigo."
# categoria: Monitoramento
# so: [windows]
# shell: powershell
# tipo: monitor
# tempo_limite: 60
# requer_admin: false
# tags: [windows-update, patches, monitor]
# variaveis:
#   - nome: ALERTA
#     rotulo: "Alerta (dias)"
#     tipo: numero
#     padrao: 45
#     obrigatorio: false
#     opcoes: []
#   - nome: CRITICO
#     rotulo: "Crítico (dias)"
#     tipo: numero
#     padrao: 90
#     obrigatorio: false
#     opcoes: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function Get-Num($v, $padrao) { if ("$v" -match '^\d+$') { [int]$v } else { $padrao } }
function Out-Status($nivel, $msg) { Write-Output "FAROL_STATUS: $nivel $msg" }

$a = Get-Num $env:FAROL_ALERTA 45; $c = Get-Num $env:FAROL_CRITICO 90
$h = Get-HotFix -ErrorAction SilentlyContinue | Where-Object InstalledOn | Sort-Object InstalledOn -Descending | Select-Object -First 1
if (-not $h) { Out-Status 'alerta' 'Nenhum hotfix registrado'; exit 0 }
$d = [math]::Round(((Get-Date) - $h.InstalledOn).TotalDays)
$msg = "Última atualização ($($h.HotFixID)) há $d dia(s)"
if ($d -ge $c) { Out-Status 'critico' $msg } elseif ($d -ge $a) { Out-Status 'alerta' $msg } else { Out-Status 'ok' $msg }
exit 0
