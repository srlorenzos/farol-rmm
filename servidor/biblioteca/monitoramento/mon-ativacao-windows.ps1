# ---
# id: mon-ativacao-windows
# nome: "Monitor - ativação do Windows"
# descricao: "Verifica se o Windows está licenciado e ativado."
# categoria: Monitoramento
# so: [windows]
# shell: powershell
# tipo: monitor
# tempo_limite: 60
# requer_admin: false
# tags: [licenca, ativacao, monitor]
# variaveis: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function Out-Status($nivel, $msg) { Write-Output "FAROL_STATUS: $nivel $msg" }

$l = Get-CimInstance SoftwareLicensingProduct -Filter "PartialProductKey IS NOT NULL AND ApplicationId='55c92734-d682-4d71-983e-d6ec3f16059f'" | Select-Object -First 1
if (-not $l) { Out-Status 'alerta' 'Licença do Windows não encontrada'; exit 0 }
if ($l.LicenseStatus -eq 1) { Out-Status 'ok' "Windows ativado ($($l.Name))" } else { Out-Status 'critico' "Windows não ativado (status $($l.LicenseStatus))" }
exit 0
