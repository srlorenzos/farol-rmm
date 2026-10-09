# ---
# id: limpar-fila-impressao
# nome: "Limpar fila de impressão travada"
# descricao: "Para o spooler, apaga os arquivos da fila (SPL/SHD) e reinicia o serviço. Resolve trabalhos presos."
# categoria: Impressoras
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 120
# requer_admin: true
# tags: [spooler, fila]
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
$p = "$env:windir\System32\spool\PRINTERS"
Write-Output ("Arquivos na fila: {0}" -f @(Get-ChildItem $p -Force -ErrorAction SilentlyContinue).Count)
if (-not (Test-Confirmar)) { Write-Output "Defina CONFIRMAR=true para limpar a fila."; exit 0 }
Stop-Service Spooler -Force
Get-ChildItem $p -Force -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue
Start-Service Spooler
Write-Output "Fila limpa; spooler reiniciado."
exit 0
