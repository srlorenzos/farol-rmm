# ---
# id: limpar-cache-aplicativos-store
# nome: "Reiniciar cache da Microsoft Store"
# descricao: "Executa wsreset para limpar o cache da Microsoft Store quando ela não abre ou não baixa aplicativos."
# categoria: Manutenção
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 120
# requer_admin: false
# tags: [store, cache]
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

if (-not (Test-Confirmar)) { Write-Output "Defina CONFIRMAR=true para executar o wsreset (abre a Store ao final)."; exit 0 }
Start-Process wsreset.exe -Wait -WindowStyle Hidden
Write-Output "Cache da Microsoft Store reiniciado."
exit 0
