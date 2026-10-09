# ---
# id: habilitar-wake-on-lan
# nome: "Habilitar Wake-on-LAN nos adaptadores"
# descricao: "Habilita o despertar por pacote mágico nos adaptadores Ethernet e permite que o adaptador acorde o computador."
# categoria: Rede
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 60
# requer_admin: true
# tags: [wol, energia, rede]
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
Get-NetAdapter -Physical | ForEach-Object {
  $pm = Get-NetAdapterPowerManagement -Name $_.Name -ErrorAction SilentlyContinue
  if ($pm) {
    Write-Output ("{0}: WakeOnMagicPacket={1}" -f $_.Name, $pm.WakeOnMagicPacket)
    if (Test-Confirmar) { Set-NetAdapterPowerManagement -Name $_.Name -WakeOnMagicPacket Enabled -ErrorAction SilentlyContinue; Write-Output "  -> habilitado" }
  }
}
if (-not (Test-Confirmar)) { Write-Output "Defina CONFIRMAR=true para habilitar." }
exit 0
