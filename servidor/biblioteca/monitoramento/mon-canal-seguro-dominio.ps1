# ---
# id: mon-canal-seguro-dominio
# nome: "Monitor - relação de confiança com o domínio"
# descricao: "Testa o canal seguro entre o computador e o domínio (Test-ComputerSecureChannel)."
# categoria: Monitoramento
# so: [windows]
# shell: powershell
# tipo: monitor
# tempo_limite: 60
# requer_admin: false
# tags: [dominio, ad, monitor]
# variaveis: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function Out-Status($nivel, $msg) { Write-Output "FAROL_STATUS: $nivel $msg" }

$cs = Get-CimInstance Win32_ComputerSystem
if (-not $cs.PartOfDomain) { Out-Status 'ok' 'Computador não pertence a domínio'; exit 0 }
try { $ok = Test-ComputerSecureChannel -ErrorAction Stop } catch { Out-Status 'alerta' "Não foi possível testar: $($_.Exception.Message)"; exit 0 }
if ($ok) { Out-Status 'ok' "Canal seguro com $($cs.Domain) íntegro" } else { Out-Status 'critico' "Canal seguro com $($cs.Domain) quebrado (reingresse ou use Reset-ComputerMachinePassword)" }
exit 0
