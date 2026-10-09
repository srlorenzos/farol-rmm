# ---
# id: plano-energia-alto-desempenho
# nome: "Ativar plano de energia Alto Desempenho"
# descricao: "Ativa o plano Alto Desempenho (cria a partir do Equilibrado quando oculto) e desativa a suspensão seletiva USB."
# categoria: Desempenho
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 60
# requer_admin: true
# tags: [energia, desempenho]
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
powercfg /getactivescheme
if (-not (Test-Confirmar)) { Write-Output "Defina CONFIRMAR=true para ativar Alto Desempenho."; exit 0 }
$guid = '8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c'
if (-not (powercfg /list | Select-String $guid)) { powercfg -duplicatescheme $guid | Out-Null }
powercfg /setactive $guid
powercfg /setacvalueindex $guid 2a737441-1930-4402-8d77-b2bebba308a3 48e6b7a6-50f5-4782-a5d4-53bb8f07e226 0
powercfg /setactive $guid
powercfg /getactivescheme
exit 0
