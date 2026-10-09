# ---
# id: mon-defender-ameacas-ativas
# nome: "Monitor - ameaças ativas detectadas pelo Defender"
# descricao: "Conta ameaças detectadas e ainda não remediadas pelo Defender."
# categoria: Monitoramento
# so: [windows]
# shell: powershell
# tipo: monitor
# tempo_limite: 60
# requer_admin: false
# tags: [defender, ameacas, monitor]
# variaveis: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function Out-Status($nivel, $msg) { Write-Output "FAROL_STATUS: $nivel $msg" }

$t = @(Get-MpThreatDetection -ErrorAction SilentlyContinue | Where-Object { $_.InitialDetectionTime -gt (Get-Date).AddDays(-7) })
$ativas = @(Get-MpThreat -ErrorAction SilentlyContinue | Where-Object { $_.IsActive })
if ($ativas.Count -gt 0) { Out-Status 'critico' ("$($ativas.Count) ameaça(s) ativa(s): " + (($ativas | Select-Object -First 3 -ExpandProperty ThreatName) -join ', ')) }
elseif ($t.Count -gt 0) { Out-Status 'alerta' "$($t.Count) detecção(ões) nos últimos 7 dias (remediadas)" }
else { Out-Status 'ok' 'Nenhuma ameaça ativa' }
exit 0
