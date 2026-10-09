# ---
# id: mon-secureboot-tpm
# nome: "Monitor - Secure Boot e TPM"
# descricao: "Verifica se o Secure Boot está ativo e o TPM presente e pronto (compatibilidade com Windows 11)."
# categoria: Monitoramento
# so: [windows]
# shell: powershell
# tipo: monitor
# tempo_limite: 60
# requer_admin: false
# tags: [secureboot, tpm, monitor]
# variaveis: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function Out-Status($nivel, $msg) { Write-Output "FAROL_STATUS: $nivel $msg" }

$sb = try { Confirm-SecureBootUEFI } catch { $null }
$t = Get-Tpm -ErrorAction SilentlyContinue
$p = @()
if ($sb -ne $true) { $p += 'Secure Boot inativo/indisponível' }
if (-not $t -or -not $t.TpmPresent) { $p += 'TPM ausente' } elseif (-not $t.TpmReady) { $p += 'TPM não pronto' }
if ($p) { Out-Status 'alerta' ($p -join '; ') } else { Out-Status 'ok' 'Secure Boot ativo e TPM pronto' }
exit 0
