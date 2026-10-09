# ---
# id: redefinir-senha-local
# nome: "Redefinir senha de usuário local"
# descricao: "Define uma nova senha para uma conta local e, opcionalmente, força a troca no próximo logon."
# categoria: Usuários e contas
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 60
# requer_admin: true
# tags: [senha, usuarios]
# variaveis:
#   - nome: USUARIO
#     rotulo: "Usuário"
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
function Test-Admin { ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator) }
function Exigir-Admin { if (-not (Test-Admin)) { Write-Output 'ERRO: este script precisa ser executado como administrador.'; exit 1 } }

Exigir-Admin
$u = "$env:FAROL_USUARIO".Trim()
$conta = Get-LocalUser -Name $u -ErrorAction SilentlyContinue
if (-not $conta) { Write-Output "Usuário não encontrado: $u"; exit 1 }
if (-not $env:FAROL_SENHA) { Write-Output "Senha obrigatória."; exit 1 }
Set-LocalUser -Name $u -Password (ConvertTo-SecureString $env:FAROL_SENHA -AsPlainText -Force)
if ("$env:FAROL_FORCAR_TROCA" -notmatch '^(0|false|nao|n)$') { & net.exe user $u /logonpasswordchg:yes | Out-Null }
Write-Output "Senha de '$u' redefinida."
exit 0
