# ---
# id: definir-perfil-rede
# nome: "Definir perfil de rede (Privada ou Pública)"
# descricao: "Altera a categoria de rede da conexão ativa, o que afeta regras de firewall e descoberta de rede."
# categoria: Rede
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 60
# requer_admin: true
# tags: [perfil, firewall]
# variaveis:
#   - nome: PERFIL
#     rotulo: "Perfil"
#     tipo: selecao
#     padrao: "Privada"
#     obrigatorio: true
#     opcoes: [Privada, Publica]
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
$cat = if ("$env:FAROL_PERFIL" -eq 'Publica') { 'Public' } else { 'Private' }
Get-NetConnectionProfile | ForEach-Object {
  Write-Output ("{0}: {1}" -f $_.Name, $_.NetworkCategory)
  if ((Test-Confirmar) -and $_.NetworkCategory -ne 'DomainAuthenticated') { Set-NetConnectionProfile -InterfaceIndex $_.InterfaceIndex -NetworkCategory $cat; Write-Output "  -> $cat" }
}
if (-not (Test-Confirmar)) { Write-Output "Nada alterado. Defina CONFIRMAR=true para aplicar." }
exit 0
