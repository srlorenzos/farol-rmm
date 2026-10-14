# ---
# id: bloquear-tela-sessoes
# nome: "Bloquear estação de trabalho"
# descricao: "Bloqueia a sessão interativa do console (LockWorkStation). Útil em incidentes de segurança."
# categoria: Utilitários
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 30
# requer_admin: false
# tags: [bloqueio, seguranca]
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
function Test-Confirmar { "$env:FAROL_CONFIRMAR" -match '^(1|true|sim|s|yes|y|verdadeiro)$' }

if (-not (Test-Confirmar)) { Write-Output "Defina CONFIRMAR=true para bloquear a tela."; exit 0 }
rundll32.exe user32.dll,LockWorkStation
Write-Output "Comando de bloqueio enviado."
exit 0
