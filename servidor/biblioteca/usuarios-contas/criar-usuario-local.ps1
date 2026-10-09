# ---
# id: criar-usuario-local
# nome: "Criar usuário local"
# descricao: "Cria uma conta local com senha informada, opcionalmente adicionando ao grupo Administradores. Idempotente: não recria usuários existentes."
# categoria: Usuários e contas
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 60
# requer_admin: true
# tags: [usuarios, criacao]
# variaveis:
#   - nome: USUARIO
#     rotulo: "Nome de usuário"
#     tipo: texto
#     padrao: ""
#     obrigatorio: true
#     opcoes: []
#   - nome: SENHA
#     rotulo: "Senha"
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
#   - nome: ADMIN
#     rotulo: "Adicionar ao grupo Administradores"
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
if ($u -notmatch '^[A-Za-z0-9._-]{1,20}$') { Write-Output "Nome de usuário inválido (A-Z, 0-9, . _ - até 20 caracteres)."; exit 1 }
if (-not $env:FAROL_SENHA) { Write-Output "Senha obrigatória."; exit 1 }
if (Get-LocalUser -Name $u -ErrorAction SilentlyContinue) { Write-Output "Usuário '$u' já existe; nada a fazer."; exit 0 }
$s = ConvertTo-SecureString $env:FAROL_SENHA -AsPlainText -Force
New-LocalUser -Name $u -Password $s -FullName "$env:FAROL_NOME_COMPLETO" -PasswordNeverExpires:$false | Out-Null
Add-LocalGroupMember -SID 'S-1-5-32-545' -Member $u
if (Test-Sim $env:FAROL_ADMIN) { Add-LocalGroupMember -SID 'S-1-5-32-544' -Member $u; Write-Output "Adicionado a Administradores." }
Write-Output "Usuário '$u' criado."
exit 0
