# ---
# id: bloquear-atualizacao-driver-wu
# nome: "Impedir drivers via Windows Update"
# descricao: "Habilita a política que exclui drivers das atualizações de qualidade do Windows Update (ExcludeWUDriversInQualityUpdate)."
# categoria: Atualizações
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 60
# requer_admin: true
# tags: [drivers, politica, windows-update]
# variaveis:
#   - nome: ACAO
#     rotulo: "Ação"
#     tipo: selecao
#     padrao: "bloquear"
#     obrigatorio: true
#     opcoes: [bloquear, permitir]
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
$k = 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\WindowsUpdate'
Write-Output ("Valor atual: {0}" -f (Get-ItemProperty $k -ErrorAction SilentlyContinue).ExcludeWUDriversInQualityUpdate)
if (-not (Test-Confirmar)) { Write-Output "Defina CONFIRMAR=true para aplicar."; exit 0 }
if (-not (Test-Path $k)) { New-Item $k -Force | Out-Null }
Set-ItemProperty $k ExcludeWUDriversInQualityUpdate $(if ("$env:FAROL_ACAO" -eq 'permitir') { 0 } else { 1 }) -Type DWord
Write-Output "Política aplicada."
exit 0
