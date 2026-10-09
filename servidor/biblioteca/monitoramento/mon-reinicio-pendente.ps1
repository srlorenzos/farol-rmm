# ---
# id: mon-reinicio-pendente
# nome: "Monitor - reinício pendente"
# descricao: "Detecta reinício pendente por Windows Update, CBS, renomeação de arquivos ou instalação de software."
# categoria: Monitoramento
# so: [windows]
# shell: powershell
# tipo: monitor
# tempo_limite: 60
# requer_admin: false
# tags: [reinicio, atualizacoes, monitor]
# variaveis: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function Out-Status($nivel, $msg) { Write-Output "FAROL_STATUS: $nivel $msg" }

$m = @()
if (Test-Path 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\WindowsUpdate\Auto Update\RebootRequired') { $m += 'Windows Update' }
if (Test-Path 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Component Based Servicing\RebootPending') { $m += 'CBS' }
if ((Get-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager' -ErrorAction SilentlyContinue).PendingFileRenameOperations) { $m += 'Renomeação de arquivos' }
if ($m) { Out-Status 'alerta' ("Reinício pendente: " + ($m -join ', ')) } else { Out-Status 'ok' 'Sem reinício pendente' }
exit 0
