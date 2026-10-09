# ---
# id: mon-url-http
# nome: "Monitor - disponibilidade de URL HTTP/HTTPS"
# descricao: "Faz requisição GET e verifica código de resposta, tempo de resposta e (opcionalmente) texto esperado."
# categoria: Monitoramento
# so: [windows]
# shell: powershell
# tipo: monitor
# tempo_limite: 60
# requer_admin: false
# tags: [http, web, monitor]
# variaveis:
#   - nome: URL
#     rotulo: "URL"
#     tipo: texto
#     padrao: ""
#     obrigatorio: true
#     opcoes: []
#   - nome: TEXTO
#     rotulo: "Texto esperado no corpo (opcional)"
#     tipo: texto
#     padrao: ""
#     obrigatorio: false
#     opcoes: []
#   - nome: ALERTA_MS
#     rotulo: "Alerta (ms)"
#     tipo: numero
#     padrao: 2000
#     obrigatorio: false
#     opcoes: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function Get-Num($v, $padrao) { if ("$v" -match '^\d+$') { [int]$v } else { $padrao } }
function Out-Status($nivel, $msg) { Write-Output "FAROL_STATUS: $nivel $msg" }

$u = "$env:FAROL_URL".Trim()
if ($u -notmatch '^https?://[^\s]+$') { Write-Output "URL inválida."; exit 2 }
$a = Get-Num $env:FAROL_ALERTA_MS 2000
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$sw = [Diagnostics.Stopwatch]::StartNew()
try { $r = Invoke-WebRequest -Uri $u -UseBasicParsing -TimeoutSec 20 -ErrorAction Stop } catch {
  $code = try { [int]$_.Exception.Response.StatusCode } catch { 0 }
  Out-Status 'critico' "Falha em $u (HTTP $code): $($_.Exception.Message)"; exit 0
}
$ms = $sw.ElapsedMilliseconds
if ($env:FAROL_TEXTO -and $r.Content -notlike "*$($env:FAROL_TEXTO)*") { Out-Status 'critico' "HTTP $($r.StatusCode) mas texto esperado ausente"; exit 0 }
$msg = "HTTP $($r.StatusCode) em $ms ms"
if ($ms -ge $a) { Out-Status 'alerta' $msg } else { Out-Status 'ok' $msg }
exit 0
