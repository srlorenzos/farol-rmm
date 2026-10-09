# ---
# id: desativar-ativar-usuario-local
# nome: "Desativar ou ativar usuário local"
# descricao: "Habilita ou desabilita uma conta local sem excluí-la. Recusa-se a desabilitar a única conta administradora ativa."
# categoria: Usuários e contas
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 60
# requer_admin: true
# tags: [usuarios, contas]
# variaveis:
#   - nome: USUARIO
#     rotulo: "Usuário"
#     tipo: texto
#     padrao: ""
#     obrigatorio: true
#     opcoes: []
#   - nome: ACAO
#     rotulo: "Ação"
#     tipo: selecao
#     padrao: "desativar"
#     obrigatorio: true
#     opcoes: [desativar, ativar]
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function Test-Admin { ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator) }
function Exigir-Admin { if (-not (Test-Admin)) { Write-Output 'ERRO: este script precisa ser executado como administrador.'; exit 1 } }

Exigir-Admin
$u = "$env:FAROL_USUARIO".Trim()
$c = Get-LocalUser -Name $u -ErrorAction SilentlyContinue
if (-not $c) { Write-Output "Usuário não encontrado."; exit 1 }
if ("$env:FAROL_ACAO" -eq 'ativar') { Enable-LocalUser -Name $u; Write-Output "'$u' ativado."; exit 0 }
$admins = Get-LocalGroupMember -SID 'S-1-5-32-544' | Where-Object { $_.ObjectClass -eq 'Usuário' -or $_.ObjectClass -eq 'User' } | Where-Object { $_.PrincipalSource -eq 'Local' -and (Get-LocalUser -SID $_.SID -ErrorAction SilentlyContinue).Enabled }
if (@($admins).Count -le 1 -and ($admins | Where-Object { $_.Name -like "*\$u" })) { Write-Output "Recusado: '$u' é o único administrador local ativo."; exit 1 }
Disable-LocalUser -Name $u
Write-Output "'$u' desativado."
exit 0
