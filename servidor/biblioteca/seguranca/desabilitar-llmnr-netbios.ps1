# ---
# id: desabilitar-llmnr-netbios
# nome: "Desabilitar LLMNR e NetBIOS sobre TCP/IP"
# descricao: "Desliga LLMNR e NetBIOS-NS, protocolos explorados em ataques de envenenamento (Responder). Pode afetar resolução de nomes em redes legadas."
# categoria: Segurança
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 120
# requer_admin: true
# tags: [llmnr, netbios, hardening]
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
$k = 'HKLM:\SOFTWARE\Policies\Microsoft\Windows NT\DNSClient'
Write-Output ("LLMNR (EnableMulticast): {0}" -f (Get-ItemProperty $k -ErrorAction SilentlyContinue).EnableMulticast)
Get-CimInstance Win32_NetworkAdapterConfiguration -Filter 'IPEnabled=true' | ForEach-Object { Write-Output ("NetBIOS em {0}: TcpipNetbiosOptions={1}" -f $_.Description, $_.TcpipNetbiosOptions) }
if (-not (Test-Confirmar)) { Write-Output "Defina CONFIRMAR=true para desabilitar."; exit 0 }
if (-not (Test-Path $k)) { New-Item $k -Force | Out-Null }
Set-ItemProperty $k EnableMulticast 0 -Type DWord
Get-CimInstance Win32_NetworkAdapterConfiguration -Filter 'IPEnabled=true' | ForEach-Object { [void](Invoke-CimMethod -InputObject $_ -MethodName SetTcpipNetbios -Arguments @{ TcpipNetbiosOptions = [uint32]2 }) }
Write-Output "LLMNR e NetBIOS desabilitados."
exit 0
