# ---
# id: redefinir-navegador-perfil
# nome: "Redefinir perfil do navegador (backup + recriar)"
# descricao: "Fecha o navegador, faz backup da pasta de perfil Default e a renomeia para que o navegador crie um perfil novo. Resolve perfis corrompidos."
# categoria: Navegadores
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 300
# requer_admin: false
# tags: [navegadores, perfil]
# variaveis:
#   - nome: NAVEGADOR
#     rotulo: "Navegador"
#     tipo: selecao
#     padrao: "chrome"
#     obrigatorio: true
#     opcoes: [chrome, edge, brave]
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

$m = @{ chrome = @("$env:LOCALAPPDATA\Google\Chrome\User Data\Default", 'chrome'); edge = @("$env:LOCALAPPDATA\Microsoft\Edge\User Data\Default", 'msedge'); brave = @("$env:LOCALAPPDATA\BraveSoftware\Brave-Browser\User Data\Default", 'brave') }
$b = "$env:FAROL_NAVEGADOR"
if (-not $m.ContainsKey($b)) { Write-Output "Navegador inválido."; exit 1 }
$p = $m[$b][0]
if (-not (Test-Path $p)) { Write-Output "Perfil não encontrado: $p"; exit 0 }
if (-not (Test-Confirmar)) { Write-Output "Defina CONFIRMAR=true (favoritos serão preservados no backup, mas o perfil será recriado)."; exit 0 }
Get-Process $m[$b][1] -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep 2
$novo = "$p.farol-bak-$(Get-Date -Format yyyyMMddHHmm)"
Rename-Item $p $novo
Write-Output "Perfil antigo salvo em: $novo"
exit 0
