# ---
# id: ad-desbloquear-usuario
# nome: "AD - desbloquear usuário"
# descricao: "Desbloqueia uma conta de usuário do Active Directory."
# categoria: Active Directory
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 60
# requer_admin: false
# tags: [ad, bloqueio]
# variaveis:
#   - nome: USUARIO
#     rotulo: "sAMAccountName"
#     tipo: texto
#     padrao: ""
#     obrigatorio: true
#     opcoes: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

if (-not (Get-Module -ListAvailable ActiveDirectory)) { Write-Output "Módulo ActiveDirectory não encontrado (instale o RSAT)."; exit 1 }
Import-Module ActiveDirectory
$u = "$env:FAROL_USUARIO".Trim()
if ($u -notmatch '^[A-Za-z0-9._-]{1,64}$') { Write-Output "Usuário inválido."; exit 1 }
$c = Get-ADUser -Identity $u -Properties LockedOut -ErrorAction Stop
if (-not $c.LockedOut) { Write-Output "'$u' não está bloqueado."; exit 0 }
Unlock-ADAccount -Identity $u
Write-Output "'$u' desbloqueado."
exit 0
