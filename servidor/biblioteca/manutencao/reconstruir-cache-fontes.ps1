# ---
# id: reconstruir-cache-fontes
# nome: "Reconstruir cache de fontes"
# descricao: "Para o serviço FontCache, apaga os arquivos de cache de fontes e reinicia o serviço. Resolve fontes ausentes ou texto borrado."
# categoria: Manutenção
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 120
# requer_admin: true
# tags: [fontes, cache]
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
if (-not (Test-Confirmar)) { Write-Output "Defina CONFIRMAR=true para reconstruir o cache de fontes."; exit 0 }
Stop-Service FontCache -Force -ErrorAction SilentlyContinue
Remove-Item "$env:windir\ServiceProfiles\LocalService\AppData\Local\FontCache\*" -Force -Recurse -ErrorAction SilentlyContinue
Remove-Item "$env:windir\System32\FNTCACHE.DAT" -Force -ErrorAction SilentlyContinue
Start-Service FontCache -ErrorAction SilentlyContinue
Write-Output "Cache de fontes reconstruído. Recomenda-se reiniciar o computador."
exit 0
