# ---
# id: mon-internet-dns
# nome: "Monitor - resolução DNS e acesso à internet"
# descricao: "Testa resolução de nome e conexão HTTPS para validar conectividade externa."
# categoria: Monitoramento
# so: [windows]
# shell: powershell
# tipo: monitor
# tempo_limite: 60
# requer_admin: false
# tags: [internet, dns, monitor]
# variaveis:
#   - nome: NOME
#     rotulo: "Nome a resolver"
#     tipo: texto
#     padrao: "www.google.com"
#     obrigatorio: false
#     opcoes: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function Out-Status($nivel, $msg) { Write-Output "FAROL_STATUS: $nivel $msg" }

$n = if ("$env:FAROL_NOME" -match '^[\w.-]+$') { $env:FAROL_NOME } else { 'www.google.com' }
try { $ip = [System.Net.Dns]::GetHostAddresses($n)[0].IPAddressToString } catch { Out-Status 'critico' "Falha ao resolver $n (DNS)"; exit 0 }
$cl = New-Object System.Net.Sockets.TcpClient
$ar = $cl.BeginConnect($ip, 443, $null, $null)
$ok = $ar.AsyncWaitHandle.WaitOne(4000) -and $cl.Connected; $cl.Close()
if ($ok) { Out-Status 'ok' "DNS e HTTPS ok ($n -> $ip)" } else { Out-Status 'critico' "DNS resolveu ($ip) mas sem conexão 443" }
exit 0
