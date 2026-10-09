# ---
# id: defender-status-protecao-adulteracao
# nome: "Proteção contra adulteração e ASR"
# descricao: "Informa se a Proteção contra Adulteração está ativa e quais regras de Redução de Superfície de Ataque (ASR) estão configuradas."
# categoria: Antivírus e Defender
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 120
# requer_admin: true
# tags: [defender, asr, hardening]
# variaveis: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

$s = Get-MpComputerStatus
Write-Output ("Tamper Protection: {0} (origem {1})" -f $s.IsTamperProtected, $s.TamperProtectionSource)
$p = Get-MpPreference
$ids = @($p.AttackSurfaceReductionRules_Ids); $ac = @($p.AttackSurfaceReductionRules_Actions)
Write-Output "Regras ASR configuradas: $($ids.Count)"
for ($i = 0; $i -lt $ids.Count; $i++) { Write-Output ("  {0}  ação={1} (0=off,1=bloquear,2=auditar,6=avisar)" -f $ids[$i], $ac[$i]) }
Write-Output "Acesso controlado a pastas: $($p.EnableControlledFolderAccess)"
exit 0
