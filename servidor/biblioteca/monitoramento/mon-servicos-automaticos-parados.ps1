# ---
# id: mon-servicos-automaticos-parados
# nome: "Monitor - serviços automáticos parados"
# descricao: "Conta serviços de início automático que não estão em execução (exclui serviços de gatilho/atrasados comuns)."
# categoria: Monitoramento
# so: [windows]
# shell: powershell
# tipo: monitor
# tempo_limite: 60
# requer_admin: false
# tags: [servicos, monitor]
# variaveis:
#   - nome: ALERTA
#     rotulo: "Alerta a partir de (quantidade)"
#     tipo: numero
#     padrao: 1
#     obrigatorio: false
#     opcoes: []
#   - nome: CRITICO
#     rotulo: "Crítico a partir de (quantidade)"
#     tipo: numero
#     padrao: 5
#     obrigatorio: false
#     opcoes: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function Get-Num($v, $padrao) { if ("$v" -match '^\d+$') { [int]$v } else { $padrao } }
function Out-Status($nivel, $msg) { Write-Output "FAROL_STATUS: $nivel $msg" }

$a = Get-Num $env:FAROL_ALERTA 1; $c = Get-Num $env:FAROL_CRITICO 5
$p = @(Get-CimInstance Win32_Service | Where-Object { $_.StartMode -eq 'Auto' -and $_.State -ne 'Running' -and $_.Name -notmatch 'sppsvc|gupdate|gupdatem|MapsBroker|RemoteRegistry|edgeupdate|edgeupdatem|CDPUserSvc|OneSyncSvc|WbioSrvc|TrustedInstaller|DoSvc|ShellHWDetection|clr_optimization|BITS|wuauserv|WSearch|tiledatamodelsvc|uhssvc|MicrosoftEdgeElevationService' })
$msg = "$($p.Count) serviço(s) automático(s) parado(s)" + $(if ($p) { ": " + (($p | Select-Object -First 8 -ExpandProperty Name) -join ', ') })
if ($p.Count -ge $c) { Out-Status 'critico' $msg } elseif ($p.Count -ge $a) { Out-Status 'alerta' $msg } else { Out-Status 'ok' 'Todos os serviços automáticos em execução' }
exit 0
