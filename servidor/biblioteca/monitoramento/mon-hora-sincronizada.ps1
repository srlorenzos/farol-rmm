# ---
# id: mon-hora-sincronizada
# nome: "Monitor - sincronização de horário"
# descricao: "Mede o desvio do relógio em relação ao servidor NTP configurado (w32tm) e alerta se passar do limite."
# categoria: Monitoramento
# so: [windows]
# shell: powershell
# tipo: monitor
# tempo_limite: 60
# requer_admin: false
# tags: [ntp, hora, monitor]
# variaveis:
#   - nome: ALERTA_SEG
#     rotulo: "Alerta (segundos de desvio)"
#     tipo: numero
#     padrao: 5
#     obrigatorio: false
#     opcoes: []
#   - nome: CRITICO_SEG
#     rotulo: "Crítico (segundos de desvio)"
#     tipo: numero
#     padrao: 60
#     obrigatorio: false
#     opcoes: []
#   - nome: SERVIDOR
#     rotulo: "Servidor NTP"
#     tipo: texto
#     padrao: "pool.ntp.br"
#     obrigatorio: false
#     opcoes: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function Get-Num($v, $padrao) { if ("$v" -match '^\d+$') { [int]$v } else { $padrao } }
function Out-Status($nivel, $msg) { Write-Output "FAROL_STATUS: $nivel $msg" }

$a = Get-Num $env:FAROL_ALERTA_SEG 5; $c = Get-Num $env:FAROL_CRITICO_SEG 60
$sv = if ("$env:FAROL_SERVIDOR" -match '^[\w.-]+$') { $env:FAROL_SERVIDOR } else { 'pool.ntp.br' }
$o = w32tm /stripchart /computer:$sv /samples:3 /dataonly 2>&1 | Out-String
$v = [regex]::Matches($o, '([+-]\d+[\.,]\d+)s') | ForEach-Object { [math]::Abs([double]($_.Groups[1].Value -replace ',', '.')) }
if (-not $v) { Out-Status 'alerta' "Não foi possível consultar $sv"; exit 0 }
$d = [math]::Round(($v | Measure-Object -Average).Average, 2)
$msg = "Desvio de $d s em relação a $sv"
if ($d -ge $c) { Out-Status 'critico' $msg } elseif ($d -ge $a) { Out-Status 'alerta' $msg } else { Out-Status 'ok' $msg }
exit 0
