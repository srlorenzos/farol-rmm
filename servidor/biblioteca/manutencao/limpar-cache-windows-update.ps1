# ---
# id: limpar-cache-windows-update
# nome: "Limpar cache de download do Windows Update"
# descricao: "Para os serviços de atualização, apaga a pasta SoftwareDistribution\\Download e reinicia os serviços. Útil quando atualizações travam."
# categoria: Manutenção
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 300
# requer_admin: true
# tags: [windows-update, cache, limpeza]
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
$pasta = "$env:windir\SoftwareDistribution\Download"
$tam = (Get-ChildItem $pasta -Recurse -Force -File -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum
Write-Output ("Cache atual: {0}" -f (Format-Tam ([int64]$tam)))
if (-not (Test-Confirmar)) { Write-Output "Nada foi alterado. Defina CONFIRMAR=true para limpar."; exit 0 }
foreach ($s in 'wuauserv','bits') { Stop-Service $s -Force -ErrorAction SilentlyContinue }
Get-ChildItem $pasta -Force -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
foreach ($s in 'bits','wuauserv') { Start-Service $s -ErrorAction SilentlyContinue }
Write-Output "Cache do Windows Update limpo e serviços reiniciados."
exit 0
