# ---
# id: defender-quarentena-listar
# nome: "Itens em quarentena do Defender"
# descricao: "Lista ameaças atualmente em quarentena (nome, severidade, recurso), útil para revisão antes de restaurar ou excluir."
# categoria: Antivírus e Defender
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 120
# requer_admin: true
# tags: [defender, quarentena]
# variaveis: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

$t = Get-MpThreat -ErrorAction SilentlyContinue
if (-not $t) { Write-Output "Nenhuma ameaça registrada."; exit 0 }
$t | Select-Object ThreatName, SeverityID, IsActive, Resources | Format-Table -AutoSize -Wrap | Out-String -Width 200 | Write-Output
exit 0
