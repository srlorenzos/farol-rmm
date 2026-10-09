# ---
# id: mon-gpo-ultima-aplicacao
# nome: "Monitor - última aplicação de GPO"
# descricao: "Verifica há quanto tempo a política de grupo foi aplicada com sucesso ao computador."
# categoria: Monitoramento
# so: [windows]
# shell: powershell
# tipo: monitor
# tempo_limite: 60
# requer_admin: false
# tags: [gpo, monitor]
# variaveis:
#   - nome: ALERTA_HORAS
#     rotulo: "Alerta (horas)"
#     tipo: numero
#     padrao: 24
#     obrigatorio: false
#     opcoes: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function Get-Num($v, $padrao) { if ("$v" -match '^\d+$') { [int]$v } else { $padrao } }
function Out-Status($nivel, $msg) { Write-Output "FAROL_STATUS: $nivel $msg" }

$cs = Get-CimInstance Win32_ComputerSystem
if (-not $cs.PartOfDomain) { Out-Status 'ok' 'Não ingressado em domínio'; exit 0 }
$k = Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Group Policy\State\Machine' -ErrorAction SilentlyContinue
$t = $null
if ($k.StartTimeHigh) { $t = [datetime]::FromFileTime(([int64]$k.StartTimeHigh -shl 32) -bor [uint32]$k.StartTimeLow) }
if (-not $t) { Out-Status 'alerta' 'Sem registro de aplicação de GPO'; exit 0 }
$h = [math]::Round(((Get-Date) - $t).TotalHours, 1)
if ($h -gt (Get-Num $env:FAROL_ALERTA_HORAS 24)) { Out-Status 'alerta' "GPO aplicada há $h h" } else { Out-Status 'ok' "GPO aplicada há $h h" }
exit 0
