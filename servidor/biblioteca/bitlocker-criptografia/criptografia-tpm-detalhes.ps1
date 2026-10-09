# ---
# id: criptografia-tpm-detalhes
# nome: "Detalhes do TPM"
# descricao: "Exibe fabricante, versão, estado de propriedade, bloqueio e capacidade de atestado do TPM."
# categoria: BitLocker e criptografia
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 120
# requer_admin: true
# tags: [tpm]
# variaveis: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

$t = Get-Tpm -ErrorAction SilentlyContinue
if (-not $t) { Write-Output "TPM não acessível."; exit 1 }
$t | Format-List TpmPresent, TpmReady, TpmEnabled, TpmActivated, TpmOwned, RestartPending, ManufacturerIdTxt, ManufacturerVersion, LockedOut | Out-String | Write-Output
$w = Get-CimInstance -Namespace 'root\cimv2\security\microsofttpm' -ClassName Win32_Tpm -ErrorAction SilentlyContinue
if ($w) { Write-Output "Versão da especificação: $($w.SpecVersion)" }
exit 0
