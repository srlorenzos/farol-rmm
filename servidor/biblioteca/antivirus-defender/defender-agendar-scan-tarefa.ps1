# ---
# id: defender-agendar-scan-tarefa
# nome: "Configurar varredura agendada e horário de atualização"
# descricao: "Define dia/hora da varredura rápida agendada e frequência de atualização de assinaturas do Defender."
# categoria: Antivírus e Defender
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 60
# requer_admin: true
# tags: [defender, agenda]
# variaveis:
#   - nome: HORA
#     rotulo: "Hora da varredura (0-23)"
#     tipo: numero
#     padrao: 12
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
$h = Get-Num $env:FAROL_HORA 12
if ($h -gt 23) { Write-Output "Hora inválida."; exit 1 }
$p = Get-MpPreference
Write-Output ("ScanScheduleQuickScanTime atual: {0}; ScanParameters: {1}" -f $p.ScanScheduleQuickScanTime, $p.ScanParameters)
if (-not (Test-Confirmar)) { Write-Output "Defina CONFIRMAR=true para aplicar."; exit 0 }
Set-MpPreference -ScanScheduleQuickScanTime ([timespan]::FromHours($h)) -SignatureUpdateInterval 4 -ScanScheduleDay 0
Write-Output "Varredura rápida diária às ${h}h; atualização a cada 4 h."
exit 0
