# ---
# id: reparar-windows-installer
# nome: "Reparar o serviço Windows Installer"
# descricao: "Reinicia o serviço msiserver e re-registra o msiexec para corrigir erros 1719/1722 ao instalar ou remover programas."
# categoria: Software
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 120
# requer_admin: true
# tags: [msi, reparo]
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
if (-not (Test-Confirmar)) { Write-Output "Defina CONFIRMAR=true para reparar."; exit 0 }
Stop-Service msiserver -Force -ErrorAction SilentlyContinue
& "$env:windir\System32\msiexec.exe" /unregister
& "$env:windir\System32\msiexec.exe" /regserver
Start-Service msiserver -ErrorAction SilentlyContinue
Write-Output ("msiserver: " + (Get-Service msiserver).Status)
exit 0
