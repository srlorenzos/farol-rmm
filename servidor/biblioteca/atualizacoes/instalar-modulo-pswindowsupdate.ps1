# ---
# id: instalar-modulo-pswindowsupdate
# nome: "Windows Update via módulo PSWindowsUpdate"
# descricao: "Instala o módulo PSWindowsUpdate (se necessário) e lista as atualizações disponíveis, sem instalar."
# categoria: Atualizações
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 900
# requer_admin: true
# tags: [windows-update, modulo]
# variaveis: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function Test-Admin { ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator) }
function Exigir-Admin { if (-not (Test-Admin)) { Write-Output 'ERRO: este script precisa ser executado como administrador.'; exit 1 } }

Exigir-Admin
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
if (-not (Get-Module -ListAvailable PSWindowsUpdate)) {
  try { if (-not (Get-PackageProvider NuGet -ErrorAction SilentlyContinue)) { Install-PackageProvider NuGet -Force | Out-Null }; Install-Module PSWindowsUpdate -Force -Scope AllUsers -ErrorAction Stop } catch { Write-Output "Falha ao instalar PSWindowsUpdate: $($_.Exception.Message)"; exit 1 }
}
Import-Module PSWindowsUpdate
Get-WindowsUpdate | Select-Object KB, Size, Title | Format-Table -AutoSize | Out-String -Width 200 | Write-Output
exit 0
