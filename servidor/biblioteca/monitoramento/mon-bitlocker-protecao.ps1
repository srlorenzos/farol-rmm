# ---
# id: mon-bitlocker-protecao
# nome: "Monitor - BitLocker ativo na unidade do sistema"
# descricao: "Verifica se o volume do sistema está criptografado e com proteção ligada."
# categoria: Monitoramento
# so: [windows]
# shell: powershell
# tipo: monitor
# tempo_limite: 60
# requer_admin: false
# tags: [bitlocker, criptografia, monitor]
# variaveis:
#   - nome: NIVEL_FALHA
#     rotulo: "Nível quando desligado"
#     tipo: selecao
#     padrao: "alerta"
#     obrigatorio: false
#     opcoes: [alerta, critico]
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function Out-Status($nivel, $msg) { Write-Output "FAROL_STATUS: $nivel $msg" }

$n = if ("$env:FAROL_NIVEL_FALHA" -eq 'critico') { 'critico' } else { 'alerta' }
try { $v = Get-BitLockerVolume -MountPoint $env:SystemDrive -ErrorAction Stop } catch { Out-Status 'alerta' 'BitLocker indisponível (edição Home ou sem privilégio)'; exit 0 }
if ($v.ProtectionStatus -eq 'On') { Out-Status 'ok' ("BitLocker ativo ($($v.EncryptionMethod), $($v.VolumeStatus))") } else { Out-Status $n ("BitLocker desligado em $env:SystemDrive ($($v.VolumeStatus))") }
exit 0
