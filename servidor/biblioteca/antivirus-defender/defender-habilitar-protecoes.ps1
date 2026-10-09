# ---
# id: defender-habilitar-protecoes
# nome: "Habilitar proteções do Defender"
# descricao: "Garante proteção em tempo real, monitoramento de comportamento, proteção de downloads, proteção de rede e envio automático de amostras em modo seguro."
# categoria: Antivírus e Defender
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 120
# requer_admin: true
# tags: [defender, hardening]
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
$p = Get-MpPreference
Write-Output ("RealTime desabilitado: {0}; Behavior desabilitado: {1}; NetworkProtection: {2}; PUA: {3}" -f $p.DisableRealtimeMonitoring, $p.DisableBehaviorMonitoring, $p.EnableNetworkProtection, $p.PUAProtection)
if (-not (Test-Confirmar)) { Write-Output "Defina CONFIRMAR=true para habilitar."; exit 0 }
Set-MpPreference -DisableRealtimeMonitoring $false -DisableBehaviorMonitoring $false -DisableIOAVProtection $false -DisableScriptScanning $false -PUAProtection Enabled -MAPSReporting Advanced -SubmitSamplesConsent SendSafeSamples -EnableNetworkProtection Enabled
Write-Output "Proteções habilitadas (políticas de GPO podem prevalecer)."
exit 0
