# ---
# id: definir-timeouts-energia
# nome: "Definir tempos de suspensão e desligamento de tela"
# descricao: "Define minutos para desligar a tela e suspender (energia de rede elétrica e bateria). 0 = nunca."
# categoria: Energia
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 60
# requer_admin: true
# tags: [energia, suspensao]
# variaveis:
#   - nome: TELA_AC
#     rotulo: "Minutos para desligar a tela (tomada)"
#     tipo: numero
#     padrao: 15
#     obrigatorio: false
#     opcoes: []
#   - nome: SUSPENDER_AC
#     rotulo: "Minutos para suspender (tomada)"
#     tipo: numero
#     padrao: 0
#     obrigatorio: false
#     opcoes: []
#   - nome: TELA_DC
#     rotulo: "Minutos para desligar a tela (bateria)"
#     tipo: numero
#     padrao: 5
#     obrigatorio: false
#     opcoes: []
#   - nome: SUSPENDER_DC
#     rotulo: "Minutos para suspender (bateria)"
#     tipo: numero
#     padrao: 15
#     obrigatorio: false
#     opcoes: []
#   - nome: CONFIRMAR
#     rotulo: "Digite true para confirmar a execução"
#     tipo: booleano
#     padrao: false
#     obrigatorio: false
#     opcoes: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function Get-Num($v, $padrao) { if ("$v" -match '^\d+$') { [int]$v } else { $padrao } }
function Test-Admin { ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator) }
function Exigir-Admin { if (-not (Test-Admin)) { Write-Output 'ERRO: este script precisa ser executado como administrador.'; exit 1 } }
function Test-Confirmar { "$env:FAROL_CONFIRMAR" -match '^(1|true|sim|s|yes|y|verdadeiro)$' }

Exigir-Admin
if (-not (Test-Confirmar)) { Write-Output "Defina CONFIRMAR=true para aplicar."; exit 0 }
powercfg /change monitor-timeout-ac (Get-Num $env:FAROL_TELA_AC 15)
powercfg /change standby-timeout-ac (Get-Num $env:FAROL_SUSPENDER_AC 0)
powercfg /change monitor-timeout-dc (Get-Num $env:FAROL_TELA_DC 5)
powercfg /change standby-timeout-dc (Get-Num $env:FAROL_SUSPENDER_DC 15)
Write-Output "Tempos aplicados ao plano ativo."
exit 0
