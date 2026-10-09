# ---
# id: limpar-cache-otimizacao-entrega
# nome: "Limpar cache de Otimização de Entrega"
# descricao: "Apaga o cache do Delivery Optimization (compartilhamento P2P de atualizações) que pode ocupar muitos GB."
# categoria: Manutenção
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 180
# requer_admin: true
# tags: [delivery-optimization, cache]
# variaveis:
#   - nome: SIMULAR
#     rotulo: "Modo simulação (não altera nada; use false para aplicar)"
#     tipo: booleano
#     padrao: true
#     obrigatorio: false
#     opcoes: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function Test-Admin { ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator) }
function Exigir-Admin { if (-not (Test-Admin)) { Write-Output 'ERRO: este script precisa ser executado como administrador.'; exit 1 } }
function Test-Simular { -not ("$env:FAROL_SIMULAR" -match '^(0|false|nao|não|n|no|falso)$') }

Exigir-Admin
try { Get-DeliveryOptimizationStatus -ErrorAction Stop | Select-Object FileId, FileSize, Status | Format-Table | Out-String | Write-Output } catch {}
if (Test-Simular) { Write-Output "SIMULAÇÃO: nada removido (SIMULAR=false para limpar)."; exit 0 }
Delete-DeliveryOptimizationCache -Force -ErrorAction SilentlyContinue
Write-Output "Cache de Otimização de Entrega limpo."
exit 0
