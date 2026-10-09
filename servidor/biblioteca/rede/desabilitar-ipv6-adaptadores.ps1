# ---
# id: desabilitar-ipv6-adaptadores
# nome: "Desabilitar IPv6 nos adaptadores"
# descricao: "Desmarca o protocolo IPv6 (ms_tcpip6) nos adaptadores físicos. Reversível com o modo habilitar."
# categoria: Rede
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 60
# requer_admin: true
# tags: [ipv6, configuracao]
# variaveis:
#   - nome: ACAO
#     rotulo: "Ação"
#     tipo: selecao
#     padrao: "desabilitar"
#     obrigatorio: false
#     opcoes: [desabilitar, habilitar]
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
$hab = "$env:FAROL_ACAO" -eq 'habilitar'
Get-NetAdapter -Physical | ForEach-Object {
  $b = Get-NetAdapterBinding -Name $_.Name -ComponentID ms_tcpip6 -ErrorAction SilentlyContinue
  Write-Output ("{0}: IPv6 {1}" -f $_.Name, $(if ($b.Enabled) { 'habilitado' } else { 'desabilitado' }))
  if (Test-Confirmar) { if ($hab) { Enable-NetAdapterBinding -Name $_.Name -ComponentID ms_tcpip6 } else { Disable-NetAdapterBinding -Name $_.Name -ComponentID ms_tcpip6 } }
}
if (-not (Test-Confirmar)) { Write-Output "Nada alterado. Defina CONFIRMAR=true para aplicar." }
exit 0
