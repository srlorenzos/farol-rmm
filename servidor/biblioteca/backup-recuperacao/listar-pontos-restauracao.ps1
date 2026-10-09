# ---
# id: listar-pontos-restauracao
# nome: "Listar pontos de restauração"
# descricao: "Lista pontos de restauração do sistema disponíveis e se a Proteção do Sistema está ativa."
# categoria: Backup e recuperação
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 120
# requer_admin: true
# tags: [restauracao]
# variaveis: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

$rp = Get-ComputerRestorePoint -ErrorAction SilentlyContinue
if (-not $rp) { Write-Output "Nenhum ponto de restauração (Proteção do Sistema desativada?)." } else { $rp | Select-Object SequenceNumber, Description, @{n='Data';e={ [Management.ManagementDateTimeConverter]::ToDateTime($_.CreationTime) }} | Format-Table -AutoSize | Out-String | Write-Output }
exit 0
