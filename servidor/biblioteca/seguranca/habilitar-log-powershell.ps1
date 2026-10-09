# ---
# id: habilitar-log-powershell
# nome: "Habilitar logging de scripts PowerShell"
# descricao: "Ativa Script Block Logging e Module Logging via políticas locais para auditoria de atividade PowerShell (eventos 4104)."
# categoria: Segurança
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 60
# requer_admin: true
# tags: [powershell, logging, auditoria]
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
$b = 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\PowerShell'
Write-Output ("ScriptBlockLogging atual: {0}" -f (Get-ItemProperty "$b\ScriptBlockLogging" -ErrorAction SilentlyContinue).EnableScriptBlockLogging)
if (-not (Test-Confirmar)) { Write-Output "Defina CONFIRMAR=true para habilitar."; exit 0 }
New-Item "$b\ScriptBlockLogging" -Force | Out-Null; Set-ItemProperty "$b\ScriptBlockLogging" EnableScriptBlockLogging 1 -Type DWord
New-Item "$b\ModuleLogging" -Force | Out-Null; Set-ItemProperty "$b\ModuleLogging" EnableModuleLogging 1 -Type DWord
New-Item "$b\ModuleLogging\ModuleNames" -Force | Out-Null; Set-ItemProperty "$b\ModuleLogging\ModuleNames" '*' '*'
Write-Output "Logging de PowerShell habilitado."
exit 0
