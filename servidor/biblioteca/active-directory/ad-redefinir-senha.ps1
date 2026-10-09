# ---
# id: ad-redefinir-senha
# nome: "AD - redefinir senha de usuário"
# descricao: "Redefine a senha de um usuário do AD e opcionalmente exige troca no próximo logon."
# categoria: Active Directory
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 60
# requer_admin: false
# tags: [ad, senha]
# variaveis:
#   - nome: USUARIO
#     rotulo: "sAMAccountName"
#     tipo: texto
#     padrao: ""
#     obrigatorio: true
#     opcoes: []
#   - nome: SENHA
#     rotulo: "Nova senha"
#     tipo: senha
#     padrao: ""
#     obrigatorio: true
#     opcoes: []
#   - nome: FORCAR_TROCA
#     rotulo: "Exigir troca no próximo logon"
#     tipo: booleano
#     padrao: true
#     obrigatorio: false
#     opcoes: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

if (-not (Get-Module -ListAvailable ActiveDirectory)) { Write-Output "Módulo ActiveDirectory não encontrado (instale o RSAT)."; exit 1 }
Import-Module ActiveDirectory
$u = "$env:FAROL_USUARIO".Trim()
if ($u -notmatch '^[A-Za-z0-9._-]{1,64}$' -or -not $env:FAROL_SENHA) { Write-Output "Parâmetros inválidos."; exit 1 }
Set-ADAccountPassword -Identity $u -Reset -NewPassword (ConvertTo-SecureString $env:FAROL_SENHA -AsPlainText -Force)
if ("$env:FAROL_FORCAR_TROCA" -notmatch '^(0|false|nao|n)$') { Set-ADUser -Identity $u -ChangePasswordAtLogon $true }
Write-Output "Senha de '$u' redefinida."
exit 0
