# ---
# id: reiniciar-spooler
# nome: "Reiniciar serviço de spooler de impressão"
# descricao: "Reinicia o serviço Spooler sem apagar a fila."
# categoria: Impressoras
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 60
# requer_admin: true
# tags: [spooler]
# variaveis: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function Test-Admin { ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator) }
function Exigir-Admin { if (-not (Test-Admin)) { Write-Output 'ERRO: este script precisa ser executado como administrador.'; exit 1 } }

Exigir-Admin
Restart-Service Spooler -Force
Write-Output ("Spooler: " + (Get-Service Spooler).Status)
exit 0
