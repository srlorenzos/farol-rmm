# ---
# id: rdp-habilitar-seguro
# nome: "Habilitar RDP com segurança (NLA)"
# descricao: "Habilita a Área de Trabalho Remota exigindo NLA, abre apenas a regra de firewall de RDP (opcionalmente restrita a IPs) e não altera a porta."
# categoria: Acesso remoto
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 60
# requer_admin: true
# tags: [rdp, acesso-remoto]
# variaveis:
#   - nome: IPS_PERMITIDOS
#     rotulo: "IPs/sub-redes permitidos (vazio = qualquer)"
#     tipo: texto
#     padrao: ""
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
function Test-Admin { ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator) }
function Exigir-Admin { if (-not (Test-Admin)) { Write-Output 'ERRO: este script precisa ser executado como administrador.'; exit 1 } }
function Test-Confirmar { "$env:FAROL_CONFIRMAR" -match '^(1|true|sim|s|yes|y|verdadeiro)$' }

Exigir-Admin
$ips = "$env:FAROL_IPS_PERMITIDOS".Trim()
if ($ips -and $ips -notmatch '^[0-9a-fA-F:./, -]+$') { Write-Output "Lista de IPs inválida."; exit 1 }
if (-not (Test-Confirmar)) { Write-Output "Defina CONFIRMAR=true para habilitar o RDP (NLA obrigatória)."; if (-not $ips) { Write-Output "Aviso: sem restrição de IP." }; exit 0 }
Set-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Control\Terminal Server' fDenyTSConnections 0 -Type DWord
Set-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Control\Terminal Server\WinStations\RDP-Tcp' UserAuthentication 1 -Type DWord
Enable-NetFirewallRule -DisplayGroup 'Área de Trabalho Remota' -ErrorAction SilentlyContinue
Enable-NetFirewallRule -DisplayGroup 'Remote Desktop' -ErrorAction SilentlyContinue
if ($ips) { Get-NetFirewallRule -DisplayGroup 'Área de Trabalho Remota', 'Remote Desktop' -ErrorAction SilentlyContinue | Where-Object { $_.Direction -eq 'Inbound' } | Set-NetFirewallRule -RemoteAddress ($ips.Split(',') | ForEach-Object { $_.Trim() }) }
Set-Service TermService -StartupType Manual -ErrorAction SilentlyContinue
Write-Output "RDP habilitado com NLA."
exit 0
