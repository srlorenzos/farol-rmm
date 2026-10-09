# ---
# id: mon-ping-host
# nome: "Monitor - disponibilidade e latência de um host"
# descricao: "Faz ping em um host e avalia perda de pacotes e latência média."
# categoria: Monitoramento
# so: [windows]
# shell: powershell
# tipo: monitor
# tempo_limite: 60
# requer_admin: false
# tags: [rede, ping, monitor]
# variaveis:
#   - nome: HOST
#     rotulo: "Host ou IP"
#     tipo: texto
#     padrao: "8.8.8.8"
#     obrigatorio: true
#     opcoes: []
#   - nome: ALERTA_MS
#     rotulo: "Alerta (ms)"
#     tipo: numero
#     padrao: 100
#     obrigatorio: false
#     opcoes: []
#   - nome: CRITICO_MS
#     rotulo: "Crítico (ms)"
#     tipo: numero
#     padrao: 300
#     obrigatorio: false
#     opcoes: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function Get-Num($v, $padrao) { if ("$v" -match '^\d+$') { [int]$v } else { $padrao } }
function Out-Status($nivel, $msg) { Write-Output "FAROL_STATUS: $nivel $msg" }

$h = "$env:FAROL_HOST".Trim()
if ($h -notmatch '^[A-Za-z0-9._:-]+$') { Write-Output "Host inválido."; exit 2 }
$a = Get-Num $env:FAROL_ALERTA_MS 100; $c = Get-Num $env:FAROL_CRITICO_MS 300
$r = Test-Connection -ComputerName $h -Count 4 -ErrorAction SilentlyContinue
$n = @($r).Count
if ($n -eq 0) { Out-Status 'critico' "$h não responde (100% de perda)"; exit 0 }
$m = [math]::Round(($r | Measure-Object ResponseTime -Average).Average, 0)
$msg = "$h : $n/4 respostas, média $m ms"
if ($n -lt 4 -and $n -le 2 -or $m -ge $c) { Out-Status 'critico' $msg } elseif ($n -lt 4 -or $m -ge $a) { Out-Status 'alerta' $msg } else { Out-Status 'ok' $msg }
exit 0
