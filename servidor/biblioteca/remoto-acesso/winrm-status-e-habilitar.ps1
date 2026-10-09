# ---
# id: winrm-status-e-habilitar
# nome: "WinRM - status e habilitação segura"
# descricao: "Mostra a configuração do WinRM (listeners, autenticação) e, com confirmação, executa Enable-PSRemoting limitado ao perfil Domínio/Privado."
# categoria: Acesso remoto
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 180
# requer_admin: true
# tags: [winrm, remoting]
# variaveis:
#   - nome: HABILITAR
#     rotulo: "Habilitar o WinRM"
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
Write-Output ("Serviço WinRM: {0}" -f (Get-Service WinRM).Status)
winrm enumerate winrm/config/listener 2>&1 | Out-String | Write-Output
if (Test-Sim $env:FAROL_HABILITAR) {
  Enable-PSRemoting -SkipNetworkProfileCheck:$false -Force
  Write-Output "WinRM habilitado."
} else { Write-Output "Somente consulta (HABILITAR=false)." }
exit 0
