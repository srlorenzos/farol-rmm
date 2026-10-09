# ---
# id: processos-sem-resposta
# nome: "Detectar aplicativos sem resposta"
# descricao: "Lista processos com janela que estão \"Não respondendo\" e, opcionalmente, os encerra."
# categoria: Serviços e processos
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 60
# requer_admin: false
# tags: [travamento, processos]
# variaveis:
#   - nome: ENCERRAR
#     rotulo: "Encerrar os processos travados"
#     tipo: booleano
#     padrao: false
#     obrigatorio: false
#     opcoes: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function Test-Sim($v) { "$v" -match '^(1|true|sim|s|yes|y|verdadeiro)$' }

$p = Get-Process | Where-Object { $_.MainWindowHandle -ne 0 -and -not $_.Responding }
if (-not $p) { Write-Output "Nenhum aplicativo travado."; exit 0 }
$p | Format-Table Id, ProcessName, MainWindowTitle -AutoSize | Out-String | Write-Output
if (Test-Sim $env:FAROL_ENCERRAR) { $p | Stop-Process -Force; Write-Output "Processos encerrados." }
exit 0
