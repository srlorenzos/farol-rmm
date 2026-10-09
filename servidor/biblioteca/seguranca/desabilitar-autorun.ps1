# ---
# id: desabilitar-autorun
# nome: "Desabilitar AutoRun/AutoPlay"
# descricao: "Desliga a execução automática de mídias removíveis (política NoDriveTypeAutoRun = 255), reduzindo risco de malware via USB."
# categoria: Segurança
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 60
# requer_admin: true
# tags: [autorun, usb, hardening]
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
$k = 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\Explorer'
$a = (Get-ItemProperty $k -ErrorAction SilentlyContinue).NoDriveTypeAutoRun
Write-Output "NoDriveTypeAutoRun atual: $a"
if ($a -eq 255) { Write-Output "Já configurado."; exit 0 }
if (-not (Test-Confirmar)) { Write-Output "Defina CONFIRMAR=true para aplicar."; exit 0 }
if (-not (Test-Path $k)) { New-Item $k -Force | Out-Null }
Set-ItemProperty $k NoDriveTypeAutoRun 255 -Type DWord
Write-Output "AutoRun desabilitado."
exit 0
