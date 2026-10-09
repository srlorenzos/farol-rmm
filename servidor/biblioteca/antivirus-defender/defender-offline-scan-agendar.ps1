# ---
# id: defender-offline-scan-agendar
# nome: "Agendar Microsoft Defender Offline"
# descricao: "Agenda a varredura offline do Defender (reinicia o computador para executar fora do Windows). Não reinicia automaticamente."
# categoria: Antivírus e Defender
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 60
# requer_admin: true
# tags: [defender, offline]
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
if (-not (Test-Confirmar)) { Write-Output "Defina CONFIRMAR=true para agendar; a varredura ocorrerá no próximo reinício."; exit 0 }
Start-MpWDOScan
Write-Output "Varredura offline solicitada: o computador reiniciará para executá-la."
exit 0
