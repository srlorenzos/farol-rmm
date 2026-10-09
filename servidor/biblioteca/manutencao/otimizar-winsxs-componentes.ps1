# ---
# id: otimizar-winsxs-componentes
# nome: "Limpar componentes antigos do Windows (WinSxS)"
# descricao: "Executa DISM /StartComponentCleanup para remover versões substituídas de componentes e liberar espaço em C:."
# categoria: Manutenção
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 1800
# requer_admin: true
# tags: [dism, winsxs, limpeza]
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
$a = & dism.exe /Online /Cleanup-Image /AnalyzeComponentStore 2>&1 | Out-String
Write-Output $a
if (-not (Test-Confirmar)) { Write-Output "Apenas análise. Defina CONFIRMAR=true para executar a limpeza."; exit 0 }
& dism.exe /Online /Cleanup-Image /StartComponentCleanup
exit $LASTEXITCODE
