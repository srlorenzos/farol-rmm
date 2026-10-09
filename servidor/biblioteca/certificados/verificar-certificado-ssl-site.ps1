# ---
# id: verificar-certificado-ssl-site
# nome: "Verificar certificado SSL de um site"
# descricao: "Conecta em host:porta e informa emissor, validade, SANs e dias restantes do certificado apresentado."
# categoria: Certificados
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 120
# requer_admin: false
# tags: [ssl, tls, certificados]
# variaveis:
#   - nome: HOST
#     rotulo: "Host"
#     tipo: texto
#     padrao: ""
#     obrigatorio: true
#     opcoes: []
#   - nome: PORTA
#     rotulo: "Porta"
#     tipo: numero
#     padrao: 443
#     obrigatorio: false
#     opcoes: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function Get-Num($v, $padrao) { if ("$v" -match '^\d+$') { [int]$v } else { $padrao } }

$h = "$env:FAROL_HOST".Trim(); $p = Get-Num $env:FAROL_PORTA 443
if ($h -notmatch '^[A-Za-z0-9._-]+$') { Write-Output "Host inválido."; exit 1 }
$tc = New-Object Net.Sockets.TcpClient
try { $tc.Connect($h, $p) } catch { Write-Output "Sem conexão com ${h}:$p"; exit 1 }
$ss = New-Object Net.Security.SslStream($tc.GetStream(), $false, { $true })
$ss.AuthenticateAsClient($h)
$c = New-Object Security.Cryptography.X509Certificates.X509Certificate2($ss.RemoteCertificate)
$san = ($c.Extensions | Where-Object { $_.Oid.Value -eq '2.5.29.17' } | ForEach-Object { $_.Format($false) }) -join ''
Write-Output ("Assunto: {0}`nEmissor: {1}`nVálido de {2:yyyy-MM-dd} até {3:yyyy-MM-dd} ({4} dias restantes)`nSANs: {5}`nProtocolo: {6}" -f $c.Subject, $c.Issuer, $c.NotBefore, $c.NotAfter, [int]($c.NotAfter - (Get-Date)).TotalDays, $san, $ss.SslProtocol)
$ss.Close(); $tc.Close()
exit 0
