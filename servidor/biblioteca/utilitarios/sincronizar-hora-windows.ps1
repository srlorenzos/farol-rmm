# ---
# id: sincronizar-hora-windows
# nome: "Sincronizar hora do Windows"
# descricao: "Configura o servidor NTP, garante o serviço W32Time em automático e força ressincronização."
# categoria: Utilitários
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 120
# requer_admin: true
# tags: [ntp, hora]
# variaveis:
#   - nome: SERVIDOR
#     rotulo: "Servidor NTP"
#     tipo: texto
#     padrao: "a.st1.ntp.br"
#     obrigatorio: false
#     opcoes: []
#   - nome: FUSO
#     rotulo: "Fuso horário (opcional)"
#     tipo: texto
#     padrao: ""
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
function Test-Admin { ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator) }
function Exigir-Admin { if (-not (Test-Admin)) { Write-Output 'ERRO: este script precisa ser executado como administrador.'; exit 1 } }
function Test-Confirmar { "$env:FAROL_CONFIRMAR" -match '^(1|true|sim|s|yes|y|verdadeiro)$' }

Exigir-Admin
$s = if ("$env:FAROL_SERVIDOR" -match '^[\w.-]+$') { $env:FAROL_SERVIDOR } else { 'a.st1.ntp.br' }
w32tm /query /status 2>&1 | Select-String 'Source|Fonte|Last Successful|Último' | ForEach-Object { $_.Line }
if (-not (Test-Confirmar)) { Write-Output "Defina CONFIRMAR=true para configurar $s e ressincronizar."; exit 0 }
if ($env:FAROL_FUSO -match '^[\w .()+,-]+$') { tzutil /s "$env:FAROL_FUSO" }
Set-Service w32time -StartupType Automatic; Start-Service w32time -ErrorAction SilentlyContinue
w32tm /config /manualpeerlist:"$s" /syncfromflags:manual /reliable:yes /update | Out-Null
w32tm /resync /force
exit 0
