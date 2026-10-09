# ---
# id: compliance-bitlocker-tpm-secureboot
# nome: "Compliance - criptografia de disco e inicialização segura"
# descricao: "Relatório PASSOU/FALHOU de BitLocker no volume do sistema, TPM pronto e Secure Boot."
# categoria: Compliance
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 120
# requer_admin: true
# tags: [bitlocker, tpm, compliance]
# variaveis: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

$bl = try { (Get-BitLockerVolume -MountPoint $env:SystemDrive -ErrorAction Stop).ProtectionStatus -eq 'On' } catch { $false }
$tpm = (Get-Tpm -ErrorAction SilentlyContinue).TpmReady
$sb = try { Confirm-SecureBootUEFI } catch { $false }
Write-Output ("[{0}] BitLocker ativo em {1}" -f $(if ($bl) { 'PASSOU' } else { 'FALHOU' }), $env:SystemDrive)
Write-Output ("[{0}] TPM pronto" -f $(if ($tpm) { 'PASSOU' } else { 'FALHOU' }))
Write-Output ("[{0}] Secure Boot ativo" -f $(if ($sb) { 'PASSOU' } else { 'FALHOU' }))
exit 0
