# ---
# id: limpar-cache-office
# nome: "Limpar cache do Office e do Outlook"
# descricao: "Remove caches temporários do Office (OfficeFileCache, Word/Excel recovery de versões antigas, RoamCache do Outlook, cache de documentos da UI). Não afeta documentos nem OSTs."
# categoria: Software
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 120
# requer_admin: false
# tags: [office, cache]
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

if (-not (Test-Confirmar)) { Write-Output "Defina CONFIRMAR=true (os aplicativos Office serão fechados)."; exit 0 }
foreach ($p in 'WINWORD', 'EXCEL', 'POWERPNT', 'OUTLOOK', 'ONENOTE', 'MSACCESS') { Get-Process $p -ErrorAction SilentlyContinue | Stop-Process -Force }
$alvos = "$env:LOCALAPPDATA\Microsoft\Office\16.0\OfficeFileCache", "$env:LOCALAPPDATA\Microsoft\Office\OTele", "$env:LOCALAPPDATA\Microsoft\Outlook\RoamCache", "$env:LOCALAPPDATA\Microsoft\Office\16.0\Wef"
foreach ($a in $alvos) { if (Test-Path $a) { Remove-Item "$a\*" -Recurse -Force -ErrorAction SilentlyContinue; Write-Output "Limpo: $a" } }
exit 0
