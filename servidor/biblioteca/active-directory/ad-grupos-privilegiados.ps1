# ---
# id: ad-grupos-privilegiados
# nome: "AD - revisão de grupos privilegiados"
# descricao: "Lista os membros dos grupos Domain Admins, Enterprise Admins, Schema Admins, Administrators e Account Operators."
# categoria: Active Directory
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 120
# requer_admin: false
# tags: [ad, privilegios, compliance]
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

if (-not (Get-Module -ListAvailable ActiveDirectory)) { Write-Output "Módulo ActiveDirectory não encontrado (instale o RSAT)."; exit 1 }
Import-Module ActiveDirectory
$d = foreach ($g in 'Domain Admins', 'Enterprise Admins', 'Schema Admins', 'Administrators', 'Account Operators') {
  try { Get-ADGroupMember -Identity $g -Recursive -ErrorAction Stop | ForEach-Object { [pscustomobject]@{ Grupo = $g; Membro = $_.SamAccountName; Tipo = $_.objectClass } } } catch {}
}
Out-Dados $d
exit 0
