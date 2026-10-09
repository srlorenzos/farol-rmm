# ---
# id: instalar-pacote-por-url
# nome: "Instalar pacote MSI/EXE a partir de URL"
# descricao: "Baixa um instalador MSI/EXE de uma URL HTTPS, valida o hash SHA-256 (obrigatório) e instala silenciosamente com os argumentos informados."
# categoria: Software
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 1800
# requer_admin: true
# tags: [instalacao, msi, exe]
# variaveis:
#   - nome: URL
#     rotulo: "URL HTTPS do instalador"
#     tipo: texto
#     padrao: ""
#     obrigatorio: true
#     opcoes: []
#   - nome: SHA256
#     rotulo: "Hash SHA-256 esperado"
#     tipo: texto
#     padrao: ""
#     obrigatorio: true
#     opcoes: []
#   - nome: ARGUMENTOS
#     rotulo: "Argumentos silenciosos (EXE)"
#     tipo: texto
#     padrao: "/S"
#     obrigatorio: false
#     opcoes: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function Test-Admin { ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator) }
function Exigir-Admin { if (-not (Test-Admin)) { Write-Output 'ERRO: este script precisa ser executado como administrador.'; exit 1 } }

Exigir-Admin
$u = "$env:FAROL_URL".Trim(); $h = "$env:FAROL_SHA256".Trim()
if ($u -notmatch '^https://[^\s"]+$') { Write-Output "Somente URLs HTTPS são aceitas."; exit 1 }
if ($h -notmatch '^[A-Fa-f0-9]{64}$') { Write-Output "Hash SHA-256 inválido."; exit 1 }
$ext = [IO.Path]::GetExtension(($u -split '\?')[0]).ToLower()
if ($ext -notin '.msi', '.exe') { Write-Output "Apenas .msi ou .exe."; exit 1 }
$tmp = Join-Path $env:TEMP ("farol-inst-" + [guid]::NewGuid().ToString('N') + $ext)
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
try { (New-Object Net.WebClient).DownloadFile($u, $tmp) } catch { Write-Output "Falha no download: $($_.Exception.Message)"; exit 1 }
$calc = (Get-FileHash $tmp -Algorithm SHA256).Hash
if ($calc -ne $h.ToUpper()) { Write-Output "Hash divergente! Esperado $h, obtido $calc. Instalação abortada."; Remove-Item $tmp -Force; exit 1 }
$args2 = if ($ext -eq '.msi') { "/i `"$tmp`" /qn /norestart" } else { "$env:FAROL_ARGUMENTOS" }
$r = Start-Process -FilePath $(if ($ext -eq '.msi') { 'msiexec.exe' } else { $tmp }) -ArgumentList $args2 -Wait -PassThru
Remove-Item $tmp -Force -ErrorAction SilentlyContinue
Write-Output "Instalador finalizou com código $($r.ExitCode)."
exit $(if ($r.ExitCode -in 0, 3010) { 0 } else { 1 })
