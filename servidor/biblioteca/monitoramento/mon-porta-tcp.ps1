# ---
# id: mon-porta-tcp
# nome: "Monitor - porta TCP acessível"
# descricao: "Testa conexão TCP a um host e porta (SQL, HTTPS, RDP, serviço interno)."
# categoria: Monitoramento
# so: [windows]
# shell: powershell
# tipo: monitor
# tempo_limite: 60
# requer_admin: false
# tags: [rede, tcp, portas, monitor]
# variaveis:
#   - nome: HOST
#     rotulo: "Host ou IP"
#     tipo: texto
#     padrao: ""
#     obrigatorio: true
#     opcoes: []
#   - nome: PORTA
#     rotulo: "Porta"
#     tipo: numero
#     padrao: 443
#     obrigatorio: true
#     opcoes: []
#   - nome: TIMEOUT_MS
#     rotulo: "Timeout (ms)"
#     tipo: numero
#     padrao: 3000
#     obrigatorio: false
#     opcoes: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function Get-Num($v, $padrao) { if ("$v" -match '^\d+$') { [int]$v } else { $padrao } }
function Out-Status($nivel, $msg) { Write-Output "FAROL_STATUS: $nivel $msg" }

$h = "$env:FAROL_HOST".Trim(); $p = Get-Num $env:FAROL_PORTA 0; $t = Get-Num $env:FAROL_TIMEOUT_MS 3000
if ($h -notmatch '^[A-Za-z0-9._:-]+$' -or $p -lt 1 -or $p -gt 65535) { Write-Output "Host/porta inválidos."; exit 2 }
$cl = New-Object System.Net.Sockets.TcpClient
$sw = [Diagnostics.Stopwatch]::StartNew()
$ar = $cl.BeginConnect($h, $p, $null, $null)
$ok = $ar.AsyncWaitHandle.WaitOne($t) -and $cl.Connected
$cl.Close()
if ($ok) { Out-Status 'ok' "${h}:$p acessível em $($sw.ElapsedMilliseconds) ms" } else { Out-Status 'critico' "${h}:$p inacessível" }
exit 0
