# ---
# id: bloquear-ip-firewall
# nome: "Bloquear endereço IP no firewall"
# descricao: "Cria regra de bloqueio de entrada para um IP ou sub-rede (resposta rápida a ataques). Idempotente."
# categoria: Firewall
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 60
# requer_admin: true
# tags: [firewall, bloqueio, incidente]
# variaveis:
#   - nome: IP
#     rotulo: "IP ou CIDR"
#     tipo: texto
#     padrao: ""
#     obrigatorio: true
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
$ip = "$env:FAROL_IP".Trim()
if ($ip -notmatch '^[0-9a-fA-F:.]+(/\d{1,3})?$') { Write-Output "IP inválido."; exit 1 }
$n = "FAROL - Bloqueio $ip"
if (Get-NetFirewallRule -DisplayName $n -ErrorAction SilentlyContinue) { Write-Output "Já bloqueado."; exit 0 }
if (-not (Test-Confirmar)) { Write-Output "Defina CONFIRMAR=true para bloquear $ip."; exit 0 }
New-NetFirewallRule -DisplayName $n -Direction Inbound -Action Block -RemoteAddress $ip | Out-Null
Write-Output "Bloqueado: $ip"
exit 0
