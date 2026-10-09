# ---
# id: mon-smart-saude-disco
# nome: "Monitor - saúde SMART dos discos"
# descricao: "Verifica a saúde reportada dos discos físicos e predição de falha SMART."
# categoria: Monitoramento
# so: [windows]
# shell: powershell
# tipo: monitor
# tempo_limite: 60
# requer_admin: false
# tags: [smart, disco, monitor]
# variaveis: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function Out-Status($nivel, $msg) { Write-Output "FAROL_STATUS: $nivel $msg" }

$ruins = @(Get-PhysicalDisk -ErrorAction SilentlyContinue | Where-Object { $_.HealthStatus -ne 'Healthy' })
$pred = @(Get-CimInstance -Namespace root\wmi -ClassName MSStorageDriver_FailurePredictStatus -ErrorAction SilentlyContinue | Where-Object PredictFailure)
if ($pred.Count -gt 0) { Out-Status 'critico' 'SMART prevê falha iminente de disco' }
elseif ($ruins.Count -gt 0) { $r = $ruins | ForEach-Object { "$($_.FriendlyName)=$($_.HealthStatus)" }; Out-Status 'alerta' ("Disco(s) não saudável(is): " + ($r -join ', ')) }
else { Out-Status 'ok' 'Discos saudáveis' }
exit 0
