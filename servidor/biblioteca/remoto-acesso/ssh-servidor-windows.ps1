# ---
# id: ssh-servidor-windows
# nome: "OpenSSH Server no Windows - status e instalação"
# descricao: "Verifica o OpenSSH Server, instala (capacidade do Windows) e inicia o serviço quando solicitado, com regra de firewall."
# categoria: Acesso remoto
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 600
# requer_admin: true
# tags: [ssh, openssh]
# variaveis:
#   - nome: INSTALAR
#     rotulo: "Instalar e habilitar"
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
$c = Get-WindowsCapability -Online -Name 'OpenSSH.Server*' | Select-Object -First 1
Write-Output "OpenSSH Server: $($c.State)"
$s = Get-Service sshd -ErrorAction SilentlyContinue
if ($s) { Write-Output "Serviço sshd: $($s.Status) ($($s.StartType))" }
if (Test-Sim $env:FAROL_INSTALAR) {
  if ($c.State -ne 'Installed') { Add-WindowsCapability -Online -Name $c.Name | Out-Null }
  Set-Service sshd -StartupType Automatic; Start-Service sshd
  if (-not (Get-NetFirewallRule -Name 'OpenSSH-Server-In-TCP' -ErrorAction SilentlyContinue)) { New-NetFirewallRule -Name 'OpenSSH-Server-In-TCP' -DisplayName 'OpenSSH Server (sshd)' -Enabled True -Direction Inbound -Protocol TCP -Action Allow -LocalPort 22 | Out-Null }
  Write-Output "sshd habilitado."
}
exit 0
