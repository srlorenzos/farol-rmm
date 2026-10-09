# ---
# id: remover-windows-old
# nome: "Remover pasta Windows.old"
# descricao: "Remove a pasta Windows.old deixada por atualizações de versão (libera vários GB). Exige confirmação explícita."
# categoria: Manutenção
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 1200
# requer_admin: true
# tags: [windows.old, limpeza]
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
$p = 'C:\Windows.old'
if (-not (Test-Path $p)) { Write-Output "Windows.old não existe."; exit 0 }
$t = (Get-ChildItem $p -Recurse -Force -File -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum
Write-Output ("Windows.old ocupa {0}. Após removê-la não será possível voltar à versão anterior." -f (Format-Tam ([int64]$t)))
if (-not (Test-Confirmar)) { Write-Output "Defina CONFIRMAR=true para remover."; exit 0 }
& takeown.exe /F $p /R /A /D Y | Out-Null
& icacls.exe $p /grant "*S-1-5-32-544:F" /T /C /Q | Out-Null
Remove-Item $p -Recurse -Force -ErrorAction SilentlyContinue
if (Test-Path $p) { Write-Output "Remoção parcial; alguns itens permanecem."; exit 1 }
Write-Output "Windows.old removida."
exit 0
