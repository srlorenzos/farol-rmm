# ---
# id: m365-instalar-modulos
# nome: "Microsoft 365 - instalar módulos PowerShell"
# descricao: "Instala/atualiza ExchangeOnlineManagement e Microsoft.Graph (e opcionalmente MicrosoftTeams) para todos os usuários."
# categoria: Microsoft 365
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 900
# requer_admin: true
# tags: [m365, modulos, instalacao]
# variaveis:
#   - nome: TEAMS
#     rotulo: "Instalar também MicrosoftTeams"
#     tipo: booleano
#     padrao: false
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
function Test-Sim($v) { "$v" -match '^(1|true|sim|s|yes|y|verdadeiro)$' }
function Test-Admin { ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator) }
function Exigir-Admin { if (-not (Test-Admin)) { Write-Output 'ERRO: este script precisa ser executado como administrador.'; exit 1 } }
function Test-Confirmar { "$env:FAROL_CONFIRMAR" -match '^(1|true|sim|s|yes|y|verdadeiro)$' }

Exigir-Admin
if (-not (Test-Confirmar)) { Write-Output "Defina CONFIRMAR=true para instalar os módulos (download de vários MB)."; exit 0 }
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
if (-not (Get-PackageProvider -Name NuGet -ErrorAction SilentlyContinue)) { Install-PackageProvider -Name NuGet -MinimumVersion 2.8.5.201 -Force | Out-Null }
$mods = @('ExchangeOnlineManagement', 'Microsoft.Graph')
if (Test-Sim $env:FAROL_TEAMS) { $mods += 'MicrosoftTeams' }
foreach ($m in $mods) { Write-Output "Instalando $m ..."; Install-Module $m -Scope AllUsers -Force -AllowClobber -ErrorAction Continue }
Write-Output "Concluído."
exit 0
