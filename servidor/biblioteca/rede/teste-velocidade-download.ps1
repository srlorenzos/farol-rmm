# ---
# id: teste-velocidade-download
# nome: "Teste simples de velocidade de download"
# descricao: "Baixa um arquivo de teste e calcula a velocidade média em Mbps. Mede apenas o download até o servidor escolhido."
# categoria: Rede
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 180
# requer_admin: false
# tags: [velocidade, internet]
# variaveis:
#   - nome: URL
#     rotulo: "URL de arquivo de teste"
#     tipo: texto
#     padrao: "https://speed.cloudflare.com/__down?bytes=25000000"
#     obrigatorio: false
#     opcoes: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function Format-Tam($b) { if ($b -ge 1GB) { '{0:N2} GB' -f ($b / 1GB) } elseif ($b -ge 1MB) { '{0:N1} MB' -f ($b / 1MB) } else { '{0:N0} KB' -f ($b / 1KB) } }

$u = if ($env:FAROL_URL -match '^https?://') { $env:FAROL_URL } else { 'https://speed.cloudflare.com/__down?bytes=25000000' }
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$tmp = Join-Path $env:TEMP 'farol-speed.bin'
$sw = [Diagnostics.Stopwatch]::StartNew()
try { (New-Object Net.WebClient).DownloadFile($u, $tmp) } catch { Write-Output "Falha no download: $($_.Exception.Message)"; exit 1 }
$sw.Stop()
$b = (Get-Item $tmp).Length; Remove-Item $tmp -Force -ErrorAction SilentlyContinue
Write-Output ("Baixados {0} em {1:N1}s = {2:N1} Mbps" -f (Format-Tam $b), $sw.Elapsed.TotalSeconds, ($b * 8 / 1e6 / $sw.Elapsed.TotalSeconds))
exit 0
