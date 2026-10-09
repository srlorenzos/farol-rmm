# ---
# id: verificar-tpm-secureboot
# nome: "Verificar TPM, Secure Boot e VBS"
# descricao: "Informa versão do TPM, estado do Secure Boot, modo de firmware (UEFI/Legado) e se a segurança baseada em virtualização está ativa (requisitos do Windows 11)."
# categoria: Segurança
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 120
# requer_admin: false
# tags: [tpm, secureboot, windows11]
# variaveis: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

$t = Get-CimInstance -Namespace 'root\cimv2\security\microsofttpm' -ClassName Win32_Tpm -ErrorAction SilentlyContinue
if ($t) { Write-Output ("TPM: presente, versão {0}, habilitado={1}, ativado={2}" -f ($t.SpecVersion -split ',')[0], $t.IsEnabled_InitialValue, $t.IsActivated_InitialValue) } else { Write-Output "TPM: não encontrado (ou execute como administrador)" }
try { Write-Output ("Secure Boot: {0}" -f $(if (Confirm-SecureBootUEFI) { 'ativado' } else { 'desativado' })) } catch { Write-Output "Secure Boot: indisponível (BIOS legado ou sem privilégio)" }
Write-Output ("Firmware: {0}" -f $env:firmware_type)
$v = Get-CimInstance -ClassName Win32_DeviceGuard -Namespace root\Microsoft\Windows\DeviceGuard -ErrorAction SilentlyContinue
if ($v) { Write-Output ("VBS: status={0}" -f $v.VirtualizationBasedSecurityStatus) }
exit 0
