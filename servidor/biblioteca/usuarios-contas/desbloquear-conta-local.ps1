# ---
# id: desbloquear-conta-local
# nome: "Desbloquear conta local"
# descricao: "Ativa e desbloqueia uma conta local bloqueada por tentativas de senha incorreta."
# categoria: Usuários e contas
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 60
# requer_admin: true
# tags: [bloqueio, usuarios]
# variaveis:
#   - nome: USUARIO
#     rotulo: "Usuário"
#     tipo: texto
#     padrao: ""
#     obrigatorio: true
#     opcoes: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function Test-Admin { ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator) }
function Exigir-Admin { if (-not (Test-Admin)) { Write-Output 'ERRO: este script precisa ser executado como administrador.'; exit 1 } }

Exigir-Admin
$u = "$env:FAROL_USUARIO".Trim()
if ($u -notmatch '^[A-Za-z0-9._-]{1,20}$') { Write-Output "Nome inválido."; exit 1 }
if (-not (Get-LocalUser -Name $u -ErrorAction SilentlyContinue)) { Write-Output "Usuário não encontrado."; exit 1 }
net user $u /active:yes
Write-Output "Conta '$u' ativada/desbloqueada."
exit 0
