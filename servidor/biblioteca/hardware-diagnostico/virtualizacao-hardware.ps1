# ---
# id: virtualizacao-hardware
# nome: "Verificar suporte e estado da virtualização"
# descricao: "Informa se a virtualização por hardware (VT-x/AMD-V, SLAT) está habilitada no firmware e se Hyper-V/WSL estão ativos."
# categoria: Hardware e diagnóstico
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 120
# requer_admin: false
# tags: [virtualizacao, hyperv]
# variaveis: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

$c = Get-CimInstance Win32_Processor | Select-Object -First 1
Write-Output ("Virtualização habilitada no firmware: {0}" -f $c.VirtualizationFirmwareEnabled)
Write-Output ("SLAT: {0}" -f $c.SecondLevelAddressTranslationExtensions)
$cs = Get-CimInstance Win32_ComputerSystem
Write-Output ("Hypervisor em execução: {0}" -f $cs.HypervisorPresent)
foreach ($f in 'Microsoft-Hyper-V-All', 'VirtualMachinePlatform', 'Microsoft-Windows-Subsystem-Linux') { $x = Get-WindowsOptionalFeature -Online -FeatureName $f -ErrorAction SilentlyContinue; if ($x) { Write-Output "$f : $($x.State)" } }
exit 0
