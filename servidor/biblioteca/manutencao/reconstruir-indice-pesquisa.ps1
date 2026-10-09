# ---
# id: reconstruir-indice-pesquisa
# nome: "Reconstruir índice de pesquisa do Windows"
# descricao: "Reinicia o serviço WSearch e força a reconstrução do índice removendo Windows.edb. Resolve pesquisa lenta ou sem resultados."
# categoria: Manutenção
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 300
# requer_admin: true
# tags: [pesquisa, indice]
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
function Format-Tam($b) { if ($b -ge 1GB) { '{0:N2} GB' -f ($b / 1GB) } elseif ($b -ge 1MB) { '{0:N1} MB' -f ($b / 1MB) } else { '{0:N0} KB' -f ($b / 1KB) } }
function Test-Confirmar { "$env:FAROL_CONFIRMAR" -match '^(1|true|sim|s|yes|y|verdadeiro)$' }

Exigir-Admin
$edb = "$env:ProgramData\Microsoft\Search\Data\Applications\Windows\Windows.edb"
if (Test-Path $edb) { Write-Output ("Índice atual: {0}" -f (Format-Tam (Get-Item $edb -Force).Length)) }
if (-not (Test-Confirmar)) { Write-Output "Defina CONFIRMAR=true para reconstruir."; exit 0 }
Stop-Service WSearch -Force -ErrorAction SilentlyContinue
Remove-Item $edb -Force -ErrorAction SilentlyContinue
Start-Service WSearch -ErrorAction SilentlyContinue
Write-Output "Serviço de pesquisa reiniciado; o índice será recriado em segundo plano."
exit 0
