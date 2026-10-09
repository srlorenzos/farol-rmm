# ---
# id: ad-membros-grupo
# nome: "AD - membros de um grupo"
# descricao: "Lista recursivamente os membros de um grupo do AD, incluindo grupos aninhados."
# categoria: Active Directory
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 120
# requer_admin: false
# tags: [ad, grupos]
# variaveis:
#   - nome: GRUPO
#     rotulo: "Nome do grupo"
#     tipo: texto
#     padrao: "Domain Admins"
#     obrigatorio: true
#     opcoes: []
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
$g = "$env:FAROL_GRUPO".Trim()
if ($g -match "[`"'*()\\]") { Write-Output "Nome de grupo inválido."; exit 1 }
$d = Get-ADGroupMember -Identity $g -Recursive | Select-Object Name, SamAccountName, objectClass
Out-Dados $d
exit 0
