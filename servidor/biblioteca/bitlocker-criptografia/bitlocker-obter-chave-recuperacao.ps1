# ---
# id: bitlocker-obter-chave-recuperacao
# nome: "Obter chaves de recuperação do BitLocker"
# descricao: "Exibe os IDs e senhas de recuperação dos volumes protegidos (dado sensível; use com cuidado)."
# categoria: BitLocker e criptografia
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 120
# requer_admin: true
# tags: [bitlocker, recuperacao]
# variaveis: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

$ok = $false
Get-BitLockerVolume -ErrorAction SilentlyContinue | ForEach-Object {
  $m = $_.MountPoint
  $_.KeyProtector | Where-Object KeyProtectorType -eq 'RecoveryPassword' | ForEach-Object { $ok = $true; Write-Output ("{0}  ID {1}  {2}" -f $m, $_.KeyProtectorId, $_.RecoveryPassword) }
}
if (-not $ok) { Write-Output "Nenhuma senha de recuperação encontrada." }
exit 0
