# ---
# id: m365-limpar-cache-credenciais-office
# nome: "Microsoft 365 - limpar credenciais e tokens do Office"
# descricao: "Remove tokens em cache (IdentityCache, OneAuth) e credenciais MicrosoftOffice do usuário para resolver loops de login do Office/Teams/OneDrive. Feche os aplicativos antes."
# categoria: Microsoft 365
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 120
# requer_admin: false
# tags: [m365, login, cache]
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

if (-not (Test-Confirmar)) { Write-Output "Defina CONFIRMAR=true (o usuário precisará entrar novamente nos aplicativos)."; exit 0 }
foreach ($p in 'OUTLOOK', 'WINWORD', 'EXCEL', 'POWERPNT', 'ONENOTE', 'Teams', 'ms-teams', 'OneDrive') { Get-Process $p -ErrorAction SilentlyContinue | Stop-Process -Force }
cmdkey /list | Select-String 'Target:.*(MicrosoftOffice|msteams|OneDrive|MicrosoftAccount)' | ForEach-Object { $t = ($_ -split 'Target:')[1].Trim(); cmdkey /delete:"$t" | Out-Null; Write-Output "Credencial removida: $t" }
foreach ($d in "$env:LOCALAPPDATA\Microsoft\IdentityCache", "$env:LOCALAPPDATA\Microsoft\OneAuth", "$env:LOCALAPPDATA\Microsoft\Office\16.0\Licensing") {
  if (Test-Path $d) { Remove-Item "$d\*" -Recurse -Force -ErrorAction SilentlyContinue; Write-Output "Limpo: $d" }
}
Write-Output "Concluído. Abra o aplicativo e entre novamente."
exit 0
