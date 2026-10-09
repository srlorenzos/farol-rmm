# ---
# id: habilitar-smartscreen
# nome: "Habilitar SmartScreen"
# descricao: "Configura o SmartScreen do Windows para exigir aprovação (política Warn) e verifica o estado atual."
# categoria: Segurança
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 60
# requer_admin: true
# tags: [smartscreen, hardening]
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
$k = 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\System'
Write-Output ("EnableSmartScreen atual: {0}" -f (Get-ItemProperty $k -ErrorAction SilentlyContinue).EnableSmartScreen)
if (-not (Test-Confirmar)) { Write-Output "Defina CONFIRMAR=true para habilitar."; exit 0 }
if (-not (Test-Path $k)) { New-Item $k -Force | Out-Null }
Set-ItemProperty $k EnableSmartScreen 1 -Type DWord
Set-ItemProperty $k ShellSmartScreenLevel 'Warn' -Type String
Write-Output "SmartScreen habilitado."
exit 0
