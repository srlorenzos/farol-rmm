# ---
# id: preparar-maquina-nova
# nome: "Preparar máquina nova (baseline)"
# descricao: "Aplica linha de base em estação nova: fuso horário, plano de energia, desabilita hibernação opcional, habilita RDP/ UAC conforme opções e nomeia o equipamento. Cada etapa é opcional."
# categoria: Onboarding e offboarding
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 900
# requer_admin: true
# tags: [onboarding, baseline]
# variaveis:
#   - nome: NOME_COMPUTADOR
#     rotulo: "Novo nome do computador (opcional)"
#     tipo: texto
#     padrao: ""
#     obrigatorio: false
#     opcoes: []
#   - nome: FUSO
#     rotulo: "Fuso horário"
#     tipo: texto
#     padrao: "E. South America Standard Time"
#     obrigatorio: false
#     opcoes: []
#   - nome: HIBERNACAO
#     rotulo: "Desabilitar hibernação"
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
Write-Output "Baseline a aplicar: fuso '$env:FAROL_FUSO'; computador '$env:FAROL_NOME_COMPUTADOR'; hibernação off=$env:FAROL_HIBERNACAO"
if (-not (Test-Confirmar)) { Write-Output "Defina CONFIRMAR=true para aplicar."; exit 0 }
$fuso = if ($env:FAROL_FUSO -match '^[\w .()+,-]+$') { $env:FAROL_FUSO } else { 'E. South America Standard Time' }
tzutil /s "$fuso"
Set-Service W32Time -StartupType Automatic; Start-Service W32Time -ErrorAction SilentlyContinue; w32tm /resync | Out-Null
powercfg /setactive SCHEME_BALANCED | Out-Null
Set-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System' EnableLUA 1 -Type DWord
Enable-ComputerRestore -Drive "$env:SystemDrive\" -ErrorAction SilentlyContinue
if (Test-Sim $env:FAROL_HIBERNACAO) { powercfg /hibernate off }
$n = "$env:FAROL_NOME_COMPUTADOR".Trim()
if ($n -match '^[A-Za-z0-9-]{1,15}$' -and $n -ne $env:COMPUTERNAME) { Rename-Computer -NewName $n -Force; Write-Output "Computador será renomeado para $n após reiniciar." }
Write-Output "Baseline aplicada."
exit 0
