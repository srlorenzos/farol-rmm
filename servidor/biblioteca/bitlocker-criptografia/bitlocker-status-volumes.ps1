# ---
# id: bitlocker-status-volumes
# nome: "Status do BitLocker em todos os volumes"
# descricao: "Mostra proteção, método de criptografia, percentual e protetores de chave de cada volume."
# categoria: BitLocker e criptografia
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 120
# requer_admin: true
# tags: [bitlocker]
# variaveis:
#   - nome: SAIDA
#     rotulo: "Formato de saída"
#     tipo: selecao
#     padrao: "texto"
#     obrigatorio: false
#     opcoes: [texto, json]
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function Out-Dados($d) { if ("$env:FAROL_SAIDA" -eq 'json') { $d | ConvertTo-Json -Depth 4 } else { ($d | Format-Table -AutoSize | Out-String -Width 220).TrimEnd() } }

try { $v = Get-BitLockerVolume -ErrorAction Stop } catch { Write-Output "BitLocker indisponível: $($_.Exception.Message)"; exit 1 }
$d = $v | ForEach-Object { [pscustomobject]@{ Volume = $_.MountPoint; Protecao = $_.ProtectionStatus; Estado = $_.VolumeStatus; Metodo = $_.EncryptionMethod; Percentual = $_.EncryptionPercentage; Protetores = (($_.KeyProtector | ForEach-Object { $_.KeyProtectorType }) -join ',') } }
Out-Dados $d
exit 0
