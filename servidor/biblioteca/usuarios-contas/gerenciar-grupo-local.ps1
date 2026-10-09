# ---
# id: gerenciar-grupo-local
# nome: "Adicionar ou remover membro de grupo local"
# descricao: "Adiciona ou remove um usuário em um grupo local (ex.: Usuários da Área de Trabalho Remota, Administradores). Idempotente."
# categoria: Usuários e contas
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 60
# requer_admin: true
# tags: [grupos, privilegios]
# variaveis:
#   - nome: GRUPO
#     rotulo: "Grupo"
#     tipo: texto
#     padrao: "Remote Desktop Users"
#     obrigatorio: true
#     opcoes: []
#   - nome: MEMBRO
#     rotulo: "Usuário ou DOMINIO\\usuario"
#     tipo: texto
#     padrao: ""
#     obrigatorio: true
#     opcoes: []
#   - nome: ACAO
#     rotulo: "Ação"
#     tipo: selecao
#     padrao: "adicionar"
#     obrigatorio: true
#     opcoes: [adicionar, remover]
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function Test-Admin { ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator) }
function Exigir-Admin { if (-not (Test-Admin)) { Write-Output 'ERRO: este script precisa ser executado como administrador.'; exit 1 } }

Exigir-Admin
$g = "$env:FAROL_GRUPO".Trim(); $m = "$env:FAROL_MEMBRO".Trim()
if ($g -notmatch '^[\w .-]+$' -or $m -notmatch '^[\w .\\@-]+$') { Write-Output "Valores inválidos."; exit 1 }
$ja = Get-LocalGroupMember -Group $g -ErrorAction Stop | Where-Object { $_.Name -ieq $m -or $_.Name -like "*\$m" }
if ("$env:FAROL_ACAO" -eq 'remover') {
  if ($ja) { Remove-LocalGroupMember -Group $g -Member $m; Write-Output "'$m' removido de '$g'." } else { Write-Output "'$m' não é membro de '$g'." }
} else {
  if ($ja) { Write-Output "'$m' já é membro de '$g'." } else { Add-LocalGroupMember -Group $g -Member $m; Write-Output "'$m' adicionado a '$g'." }
}
exit 0
