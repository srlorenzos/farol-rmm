# ---
# id: renomear-conta-administrador
# nome: "Renomear conta Administrador local"
# descricao: "Renomeia a conta Administrador interna (SID -500), prática comum de hardening, e opcionalmente a desabilita."
# categoria: Usuários e contas
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 60
# requer_admin: true
# tags: [hardening, admin]
# variaveis:
#   - nome: NOVO_NOME
#     rotulo: "Novo nome"
#     tipo: texto
#     padrao: ""
#     obrigatorio: true
#     opcoes: []
#   - nome: DESABILITAR
#     rotulo: "Desabilitar após renomear"
#     tipo: booleano
#     padrao: false
#     obrigatorio: false
#     opcoes: []
#   - nome: CONFIRMAR
#     rotulo: "Digite true para confirmar a execução"
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
function Test-Confirmar { "$env:FAROL_CONFIRMAR" -match '^(1|true|sim|s|yes|y|verdadeiro)$' }

Exigir-Admin
$n = "$env:FAROL_NOVO_NOME".Trim()
if ($n -notmatch '^[A-Za-z0-9._-]{1,20}$') { Write-Output "Nome inválido."; exit 1 }
$a = Get-LocalUser | Where-Object { $_.SID.Value -like '*-500' }
Write-Output "Conta interna atual: $($a.Name) (ativa=$($a.Enabled))"
if ($a.Name -eq $n) { Write-Output "Já possui esse nome."; exit 0 }
if (-not (Test-Confirmar)) { Write-Output "Defina CONFIRMAR=true para renomear."; exit 0 }
Rename-LocalUser -SID $a.SID -NewName $n
if (Test-Sim $env:FAROL_DESABILITAR) { Disable-LocalUser -SID $a.SID; Write-Output "Conta desabilitada." }
Write-Output "Renomeada para $n."
exit 0
