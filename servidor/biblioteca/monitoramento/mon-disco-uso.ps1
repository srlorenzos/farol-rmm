# ---
# id: mon-disco-uso
# nome: "Monitor - uso de disco de uma unidade"
# descricao: "Alerta quando o percentual usado da unidade passa dos limites de alerta ou crítico."
# categoria: Monitoramento
# so: [windows]
# shell: powershell
# tipo: monitor
# tempo_limite: 60
# requer_admin: false
# tags: [disco, capacidade, monitor]
# variaveis:
#   - nome: UNIDADE
#     rotulo: "Unidade"
#     tipo: texto
#     padrao: "C"
#     obrigatorio: false
#     opcoes: []
#   - nome: ALERTA
#     rotulo: "Alerta a partir de (% usado)"
#     tipo: numero
#     padrao: 85
#     obrigatorio: false
#     opcoes: []
#   - nome: CRITICO
#     rotulo: "Crítico a partir de (% usado)"
#     tipo: numero
#     padrao: 95
#     obrigatorio: false
#     opcoes: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function Get-Num($v, $padrao) { if ("$v" -match '^\d+$') { [int]$v } else { $padrao } }
function Out-Status($nivel, $msg) { Write-Output "FAROL_STATUS: $nivel $msg" }

$u = if ("$env:FAROL_UNIDADE" -match '^[A-Za-z]:?$') { $env:FAROL_UNIDADE.Substring(0,1).ToUpper() } else { 'C' }
$a = Get-Num $env:FAROL_ALERTA 85; $c = Get-Num $env:FAROL_CRITICO 95
$v = Get-Volume -DriveLetter $u -ErrorAction SilentlyContinue
if (-not $v -or $v.Size -eq 0) { Write-Output "Unidade $u`: não encontrada."; exit 2 }
$pct = [math]::Round(100 - ($v.SizeRemaining / $v.Size * 100), 1)
$msg = "${u}: $pct% usado, $([math]::Round($v.SizeRemaining/1GB,1)) GB livres"
if ($pct -ge $c) { Out-Status 'critico' $msg } elseif ($pct -ge $a) { Out-Status 'alerta' $msg } else { Out-Status 'ok' $msg }
exit 0
