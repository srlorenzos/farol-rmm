# ---
# id: bitlocker-habilitar-volume
# nome: "Habilitar BitLocker em um volume"
# descricao: "Ativa o BitLocker (XTS-AES 256) em um volume com protetor TPM (sistema) ou senha de recuperação, e imprime a chave de recuperação. Exige confirmação."
# categoria: BitLocker e criptografia
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 600
# requer_admin: true
# tags: [bitlocker, criptografia]
# variaveis:
#   - nome: UNIDADE
#     rotulo: "Letra da unidade"
#     tipo: texto
#     padrao: "C"
#     obrigatorio: true
#     opcoes: []
#   - nome: CONFIRMAR
#     rotulo: "Digite true para confirmar a execução"
#     tipo: booleano
#     padrao: false
#     obrigatorio: false
#     opcoes: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function Test-Admin { ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator) }
function Exigir-Admin { if (-not (Test-Admin)) { Write-Output 'ERRO: este script precisa ser executado como administrador.'; exit 1 } }
function Test-Confirmar { "$env:FAROL_CONFIRMAR" -match '^(1|true|sim|s|yes|y|verdadeiro)$' }

Exigir-Admin
$u = if ("$env:FAROL_UNIDADE" -match '^[A-Za-z]:?$') { $env:FAROL_UNIDADE.Substring(0,1).ToUpper() + ':' } else { 'C:' }
$v = Get-BitLockerVolume -MountPoint $u -ErrorAction Stop
Write-Output "$u : $($v.VolumeStatus), proteção $($v.ProtectionStatus)"
if ($v.ProtectionStatus -eq 'On') { Write-Output "Já protegido."; exit 0 }
$tpm = Get-Tpm
if ($u -eq $env:SystemDrive -and -not $tpm.TpmReady) { Write-Output "TPM não pronto; habilite o TPM no firmware antes."; exit 1 }
if (-not (Test-Confirmar)) { Write-Output "Defina CONFIRMAR=true para criptografar $u (a chave de recuperação será exibida; guarde-a)."; exit 0 }
if ($u -eq $env:SystemDrive) { Enable-BitLocker -MountPoint $u -EncryptionMethod XtsAes256 -UsedSpaceOnly -TpmProtector -SkipHardwareTest | Out-Null; Add-BitLockerKeyProtector -MountPoint $u -RecoveryPasswordProtector | Out-Null }
else { Enable-BitLocker -MountPoint $u -EncryptionMethod XtsAes256 -UsedSpaceOnly -RecoveryPasswordProtector | Out-Null }
(Get-BitLockerVolume -MountPoint $u).KeyProtector | Where-Object KeyProtectorType -eq 'RecoveryPassword' | ForEach-Object { Write-Output "CHAVE DE RECUPERAÇÃO [$($_.KeyProtectorId)]: $($_.RecoveryPassword)" }
exit 0
