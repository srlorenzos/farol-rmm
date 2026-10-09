# ---
# id: baixar-arquivo-url
# nome: "Baixar arquivo de uma URL"
# descricao: "Baixa um arquivo HTTPS para uma pasta local e opcionalmente valida o SHA-256."
# categoria: Utilitários
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 900
# requer_admin: false
# tags: [download]
# variaveis:
#   - nome: URL
#     rotulo: "URL HTTPS"
#     tipo: texto
#     padrao: ""
#     obrigatorio: true
#     opcoes: []
#   - nome: DESTINO
#     rotulo: "Pasta de destino"
#     tipo: texto
#     padrao: "C:\\Windows\\Temp"
#     obrigatorio: false
#     opcoes: []
#   - nome: SHA256
#     rotulo: "SHA-256 esperado (opcional)"
#     tipo: texto
#     padrao: ""
#     obrigatorio: false
#     opcoes: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function Format-Tam($b) { if ($b -ge 1GB) { '{0:N2} GB' -f ($b / 1GB) } elseif ($b -ge 1MB) { '{0:N1} MB' -f ($b / 1MB) } else { '{0:N0} KB' -f ($b / 1KB) } }

$u = "$env:FAROL_URL".Trim()
if ($u -notmatch '^https://[^\s"]+$') { Write-Output "Apenas URLs HTTPS."; exit 1 }
$d = if ($env:FAROL_DESTINO) { $env:FAROL_DESTINO } else { "$env:windir\Temp" }
New-Item $d -ItemType Directory -Force | Out-Null
$nome = [IO.Path]::GetFileName(($u -split '\?')[0]); if (-not $nome) { $nome = 'download.bin' }
$f = Join-Path $d ($nome -replace '[^\w.-]', '_')
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
(New-Object Net.WebClient).DownloadFile($u, $f)
$h = (Get-FileHash $f -Algorithm SHA256).Hash
Write-Output ("Baixado: {0} ({1})`nSHA-256: {2}" -f $f, (Format-Tam (Get-Item $f).Length), $h)
if ($env:FAROL_SHA256 -and $env:FAROL_SHA256.ToUpper() -ne $h) { Write-Output "HASH DIVERGENTE do esperado!"; exit 1 }
exit 0
