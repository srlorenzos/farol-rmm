# ---
# id: onboarding-criar-usuario-padrao
# nome: "Onboarding - criar usuário e configurar perfil base"
# descricao: "Cria um usuário padrão com senha temporária (troca obrigatória no primeiro logon) e adiciona a grupos opcionais como Usuários da Área de Trabalho Remota."
# categoria: Onboarding e offboarding
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 120
# requer_admin: true
# tags: [onboarding, usuarios]
# variaveis:
#   - nome: USUARIO
#     rotulo: "Usuário"
#     tipo: texto
#     padrao: ""
#     obrigatorio: true
#     opcoes: []
#   - nome: SENHA_TEMP
#     rotulo: "Senha temporária"
#     tipo: senha
#     padrao: ""
#     obrigatorio: true
#     opcoes: []
#   - nome: NOME_COMPLETO
#     rotulo: "Nome completo"
#     tipo: texto
#     padrao: ""
#     obrigatorio: false
#     opcoes: []
#   - nome: RDP
#     rotulo: "Permitir RDP"
#     tipo: booleano
#     padrao: false
#     obrigatorio: false
#     opcoes: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function Test-Sim($v) { "$v" -match '^(1|true|sim|s|yes|y|verdadeiro)$' }
function Test-Admin { ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator) }
function Exigir-Admin { if (-not (Test-Admin)) { Write-Output 'ERRO: este script precisa ser executado como administrador.'; exit 1 } }

Exigir-Admin
$u = "$env:FAROL_USUARIO".Trim()
if ($u -notmatch '^[A-Za-z0-9._-]{1,20}$' -or -not $env:FAROL_SENHA_TEMP) { Write-Output "Parâmetros inválidos."; exit 1 }
if (Get-LocalUser -Name $u -ErrorAction SilentlyContinue) { Write-Output "Usuário já existe."; exit 0 }
New-LocalUser -Name $u -Password (ConvertTo-SecureString $env:FAROL_SENHA_TEMP -AsPlainText -Force) -FullName "$env:FAROL_NOME_COMPLETO" | Out-Null
Add-LocalGroupMember -SID 'S-1-5-32-545' -Member $u
net user $u /logonpasswordchg:yes | Out-Null
if (Test-Sim $env:FAROL_RDP) { Add-LocalGroupMember -SID 'S-1-5-32-555' -Member $u }
Write-Output "Usuário '$u' criado; troca de senha obrigatória no primeiro logon."
exit 0
