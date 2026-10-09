# ---
# id: habilitar-auditoria-logon
# nome: "Habilitar auditoria de logon e contas"
# descricao: "Configura a política de auditoria avançada (auditpol) para registrar logon/logoff, bloqueios e gerenciamento de contas."
# categoria: Segurança
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 60
# requer_admin: true
# tags: [auditoria, auditpol]
# variaveis:
#   - nome: CONFIRMAR
#     rotulo: "Digite true para confirmar a execução"
#     tipo: booleano
#     padrao: false
#     obrigatorio: false
#     opcoes: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function Test-Admin { ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator) }
function Exigir-Admin { if (-not (Test-Admin)) { Write-Output 'ERRO: este script precisa ser executado como administrador.'; exit 1 } }
function Test-Confirmar { "$env:FAROL_CONFIRMAR" -match '^(1|true|sim|s|yes|y|verdadeiro)$' }

Exigir-Admin
auditpol /get /category:"Logon/Logoff","Account Management" 2>&1 | Out-String | Write-Output
if (-not (Test-Confirmar)) { Write-Output "Defina CONFIRMAR=true para habilitar a auditoria."; exit 0 }
foreach ($s in 'Logon', 'Logoff', 'Account Lockout', 'User Account Management', 'Security Group Management') {
  auditpol /set /subcategory:"$s" /success:enable /failure:enable | Out-Null
}
Write-Output "Auditoria configurada."
exit 0
