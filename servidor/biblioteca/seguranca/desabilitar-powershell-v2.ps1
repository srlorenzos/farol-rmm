# ---
# id: desabilitar-powershell-v2
# nome: "Desabilitar PowerShell 2.0"
# descricao: "Remove o recurso legado PowerShell 2.0, que permite contornar logging e AMSI."
# categoria: Segurança
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 300
# requer_admin: true
# tags: [powershell, hardening]
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
$f = Get-WindowsOptionalFeature -Online -FeatureName MicrosoftWindowsPowerShellV2Root -ErrorAction SilentlyContinue
if (-not $f) { Write-Output "Recurso indisponível neste sistema."; exit 0 }
Write-Output "PowerShell 2.0: $($f.State)"
if ($f.State -ne 'Enabled') { Write-Output "Já desabilitado."; exit 0 }
if (-not (Test-Confirmar)) { Write-Output "Defina CONFIRMAR=true para desabilitar."; exit 0 }
Disable-WindowsOptionalFeature -Online -FeatureName MicrosoftWindowsPowerShellV2Root -NoRestart | Out-Null
Write-Output "PowerShell 2.0 desabilitado."
exit 0
