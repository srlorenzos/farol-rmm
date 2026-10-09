# ---
# id: compliance-admin-local-gerenciados
# nome: "Compliance - administradores locais fora da lista aprovada"
# descricao: "Compara os membros do grupo Administradores local com uma lista aprovada e reporta excedentes."
# categoria: Compliance
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 120
# requer_admin: false
# tags: [admin, privilegios, compliance]
# variaveis:
#   - nome: APROVADOS
#     rotulo: "Contas aprovadas separadas por vírgula (nome sem domínio)"
#     tipo: texto
#     padrao: "Administrator"
#     obrigatorio: false
#     opcoes: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

$ok = ("$env:FAROL_APROVADOS" -replace '\s', '').ToLower().Split(',') | Where-Object { $_ }
$m = Get-LocalGroupMember -SID 'S-1-5-32-544'
$ex = $m | Where-Object { ($_.Name -split '\\')[-1].ToLower() -notin $ok -and $_.Name -notmatch 'Domain Admins|Admins. do dom' }
if ($ex) { Write-Output "Administradores NÃO aprovados:"; $ex | ForEach-Object { " - $($_.Name) ($($_.ObjectClass), $($_.PrincipalSource))" } } else { Write-Output "Todos os administradores locais estão na lista aprovada." }
exit 0
