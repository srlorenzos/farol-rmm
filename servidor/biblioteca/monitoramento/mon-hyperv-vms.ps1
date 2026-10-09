# ---
# id: mon-hyperv-vms
# nome: "Monitor - máquinas virtuais Hyper-V"
# descricao: "Verifica o estado das VMs Hyper-V; crítico se alguma VM esperada estiver parada."
# categoria: Monitoramento
# so: [windows]
# shell: powershell
# tipo: monitor
# tempo_limite: 60
# requer_admin: false
# tags: [hyperv, vm, monitor]
# variaveis:
#   - nome: VMS
#     rotulo: "VMs obrigatórias (vazio = todas)"
#     tipo: texto
#     padrao: ""
#     obrigatorio: false
#     opcoes: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function Out-Status($nivel, $msg) { Write-Output "FAROL_STATUS: $nivel $msg" }

if (-not (Get-Command Get-VM -ErrorAction SilentlyContinue)) { Out-Status 'ok' 'Hyper-V não instalado'; exit 0 }
$lista = ("$env:FAROL_VMS" -replace '\s*,\s*', ',').Split(',') | Where-Object { $_ }
$vms = Get-VM | Where-Object { -not $lista -or $_.Name -in $lista }
$off = @($vms | Where-Object State -ne 'Running')
if ($off.Count) { Out-Status 'critico' ("VM(s) fora de execução: " + (($off | ForEach-Object { "$($_.Name)=$($_.State)" }) -join ', ')) } else { Out-Status 'ok' "$(@($vms).Count) VM(s) em execução" }
exit 0
