# ---
# id: limpar-cache-autocompletar-outlook
# nome: "Limpar cache de preenchimento automático do Outlook"
# descricao: "Remove os arquivos de nickname/autocomplete (.nk2, RoamCache Stream_Autocomplete) que causam sugestões de endereço erradas."
# categoria: E-mail e Outlook
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 60
# requer_admin: false
# tags: [outlook, cache, autocompletar]
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

if (-not (Test-Confirmar)) { Write-Output "Defina CONFIRMAR=true (Outlook será fechado)."; exit 0 }
Get-Process OUTLOOK -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep 1
Get-ChildItem "$env:LOCALAPPDATA\Microsoft\Outlook\RoamCache" -Filter 'Stream_Autocomplete*' -ErrorAction SilentlyContinue | Remove-Item -Force
Get-ChildItem "$env:APPDATA\Microsoft\Outlook" -Filter *.nk2 -ErrorAction SilentlyContinue | Remove-Item -Force
Write-Output "Cache de autocompletar removido."
exit 0
