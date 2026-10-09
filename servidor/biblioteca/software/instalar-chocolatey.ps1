# ---
# id: instalar-chocolatey
# nome: "Instalar Chocolatey"
# descricao: "Instala o gerenciador de pacotes Chocolatey caso ainda não esteja presente (idempotente)."
# categoria: Software
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 300
# requer_admin: true
# tags: [chocolatey, instalacao]
# variaveis: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function Test-Admin { ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator) }
function Exigir-Admin { if (-not (Test-Admin)) { Write-Output 'ERRO: este script precisa ser executado como administrador.'; exit 1 } }

Exigir-Admin
if (Get-Command choco.exe -ErrorAction SilentlyContinue) { Write-Output ("Chocolatey já instalado: " + (choco --version)); exit 0 }
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
try { Invoke-Expression ((New-Object Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1')) } catch { Write-Output "Falha: $($_.Exception.Message)"; exit 1 }
Write-Output ("Chocolatey instalado: " + (& "$env:ProgramData\chocolatey\bin\choco.exe" --version))
exit 0
