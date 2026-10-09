# ---
# id: pausar-retomar-windows-update
# nome: "Pausar ou retomar atualizações do Windows"
# descricao: "Define as configurações de política para adiar atualizações por N dias ou remove a pausa."
# categoria: Atualizações
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 60
# requer_admin: true
# tags: [windows-update, politica]
# variaveis:
#   - nome: ACAO
#     rotulo: "Ação"
#     tipo: selecao
#     padrao: "pausar"
#     obrigatorio: true
#     opcoes: [pausar, retomar]
#   - nome: DIAS
#     rotulo: "Dias de pausa (máx. 35)"
#     tipo: numero
#     padrao: 14
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
function Get-Num($v, $padrao) { if ("$v" -match '^\d+$') { [int]$v } else { $padrao } }
function Test-Admin { ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator) }
function Exigir-Admin { if (-not (Test-Admin)) { Write-Output 'ERRO: este script precisa ser executado como administrador.'; exit 1 } }
function Test-Confirmar { "$env:FAROL_CONFIRMAR" -match '^(1|true|sim|s|yes|y|verdadeiro)$' }

Exigir-Admin
$k = 'HKLM:\SOFTWARE\Microsoft\WindowsUpdate\UX\Settings'
if (-not (Test-Confirmar)) { Write-Output "Defina CONFIRMAR=true para aplicar '$env:FAROL_ACAO'."; exit 0 }
if ("$env:FAROL_ACAO" -eq 'retomar') {
  foreach ($n in 'PauseUpdatesExpiryTime', 'PauseFeatureUpdatesStartTime', 'PauseQualityUpdatesStartTime', 'PauseUpdatesStartTime') { Remove-ItemProperty $k $n -ErrorAction SilentlyContinue }
  Write-Output "Pausa removida."
} else {
  $d = [math]::Min((Get-Num $env:FAROL_DIAS 14), 35)
  $ini = (Get-Date).ToUniversalTime(); $fim = $ini.AddDays($d)
  Set-ItemProperty $k PauseUpdatesStartTime $ini.ToString('yyyy-MM-ddTHH:mm:ssZ'); Set-ItemProperty $k PauseUpdatesExpiryTime $fim.ToString('yyyy-MM-ddTHH:mm:ssZ')
  Write-Output "Atualizações pausadas até $($fim.ToString('yyyy-MM-dd'))."
}
exit 0
