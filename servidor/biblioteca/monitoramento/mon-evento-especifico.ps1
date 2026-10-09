# ---
# id: mon-evento-especifico
# nome: "Monitor - ocorrência de um evento específico"
# descricao: "Conta eventos de um log por ID (e provedor opcional) em uma janela, para criar monitores personalizados (ex.: 1074 reinício inesperado, 6008)."
# categoria: Monitoramento
# so: [windows]
# shell: powershell
# tipo: monitor
# tempo_limite: 60
# requer_admin: false
# tags: [eventos, personalizado, monitor]
# variaveis:
#   - nome: LOG
#     rotulo: "Nome do log"
#     tipo: texto
#     padrao: "System"
#     obrigatorio: true
#     opcoes: []
#   - nome: ID_EVENTO
#     rotulo: "ID do evento"
#     tipo: numero
#     padrao: 6008
#     obrigatorio: true
#     opcoes: []
#   - nome: HORAS
#     rotulo: "Janela (horas)"
#     tipo: numero
#     padrao: 24
#     obrigatorio: false
#     opcoes: []
#   - nome: ALERTA
#     rotulo: "Alerta a partir de (qtde)"
#     tipo: numero
#     padrao: 1
#     obrigatorio: false
#     opcoes: []
#   - nome: CRITICO
#     rotulo: "Crítico a partir de (qtde)"
#     tipo: numero
#     padrao: 10
#     obrigatorio: false
#     opcoes: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function Get-Num($v, $padrao) { if ("$v" -match '^\d+$') { [int]$v } else { $padrao } }
function Out-Status($nivel, $msg) { Write-Output "FAROL_STATUS: $nivel $msg" }

$log = "$env:FAROL_LOG".Trim()
if ($log -notmatch '^[\w .\/-]+$') { Write-Output "Log inválido."; exit 2 }
$id = Get-Num $env:FAROL_ID_EVENTO 0
if ($id -le 0) { Write-Output "ID inválido."; exit 2 }
$h = Get-Num $env:FAROL_HORAS 24; $a = Get-Num $env:FAROL_ALERTA 1; $c = Get-Num $env:FAROL_CRITICO 10
$n = @(Get-WinEvent -FilterHashtable @{ LogName = $log; Id = $id; StartTime = (Get-Date).AddHours(-$h) } -ErrorAction SilentlyContinue).Count
$msg = "$n ocorrência(s) do evento $id em $log nas últimas ${h}h"
if ($n -ge $c) { Out-Status 'critico' $msg } elseif ($n -ge $a) { Out-Status 'alerta' $msg } else { Out-Status 'ok' $msg }
exit 0
