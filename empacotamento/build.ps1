<#
  Gera os instaladores do Farol RMM neste computador.

  Uso (a política de execução do Windows costuma bloquear .ps1, então rode assim):
    powershell -ExecutionPolicy Bypass -File empacotamento\build.ps1
    powershell -ExecutionPolicy Bypass -File empacotamento\build.ps1 -PularServidor     # sem o farol-servidor.exe
    powershell -ExecutionPolicy Bypass -File empacotamento\build.ps1 -PularSetup        # sem o Inno Setup

  Pré-requisitos: Python 3.10+ com `pip install pyinstaller pywin32 psutil pillow`, Node 22+ e (para o Setup)
  Inno Setup 6 (winget install JRSoftware.InnoSetup). O script procura o ISCC.exe sozinho; use $env:ISCC para apontar.

  Saída em empacotamento\dist\release\: FarolAgenteSetup.exe, farol-agente.exe, farol-bandeja.exe,
  farol-servidor.exe e SHA256SUMS.txt (os mesmos nomes do GitHub Release).
  Assinatura opcional: defina CERT_PFX_BASE64 (ou CERT_PFX com o caminho do .pfx) e CERT_SENHA.
#>
param(
  [switch]$PularServidor,
  [switch]$PularSetup,
  [string]$Python = 'python'
)

$ErrorActionPreference = 'Stop'
$Emp = $PSScriptRoot
$Raiz = Split-Path $Emp -Parent
$Dist = Join-Path $Emp 'dist'
$Build = Join-Path $Emp 'build'
$Versao = (Get-Content (Join-Path $Emp 'VERSION') -Raw).Trim()

function Passo($texto) { Write-Host "`n== $texto" -ForegroundColor Yellow }
function Checar($texto) { if ($LASTEXITCODE -ne 0) { throw "$texto falhou (código $LASTEXITCODE)" } }

Write-Host "Farol RMM - build da versão $Versao" -ForegroundColor Cyan
Remove-Item -Recurse -Force $Dist, $Build -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force $Dist, $Build | Out-Null

# ---------- assinatura opcional (só com certificado) ----------
$pfx = $env:CERT_PFX
if (-not $pfx -and $env:CERT_PFX_BASE64) {
  $pfx = Join-Path $Build 'certificado.pfx'
  [IO.File]::WriteAllBytes($pfx, [Convert]::FromBase64String($env:CERT_PFX_BASE64))
}
$assinar = [bool]($pfx -and $env:CERT_SENHA)
function Assinar([string[]]$caminhos) {
  if (-not $assinar) { return }
  $signtool = Get-ChildItem "${env:ProgramFiles(x86)}\Windows Kits\10\bin\*\x64\signtool.exe" -ErrorAction SilentlyContinue |
    Sort-Object FullName -Descending | Select-Object -First 1
  if (-not $signtool) { throw 'signtool.exe não encontrado (instale o Windows SDK).' }
  foreach ($c in $caminhos | Where-Object { Test-Path $_ }) {
    & $signtool.FullName sign /f $pfx /p $env:CERT_SENHA /fd SHA256 /tr http://timestamp.digicert.com /td SHA256 $c; Checar "assinatura de $c"
  }
}
if (-not $assinar) { Write-Host 'Sem certificado (CERT_PFX/CERT_PFX_BASE64 + CERT_SENHA): executáveis sem assinatura; o SmartScreen vai avisar.' }

Passo 'Recursos (ícone) e versão'
& $Python (Join-Path $Emp 'recursos\gerar_recursos.py'); Checar 'gerar_recursos'
& $Python (Join-Path $Emp 'agente\versao.py') $Build; Checar 'versao.py'
$env:FAROL_BUILD = $Build

Passo 'Agente em pasta (serviço do Windows + Setup)'
$env:FAROL_MODO = 'onedir'
& $Python -m PyInstaller --noconfirm --distpath (Join-Path $Dist 'onedir') --workpath (Join-Path $Build 'work-agente-onedir') (Join-Path $Emp 'agente\farol-agente.spec'); Checar 'PyInstaller (agente onedir)'

Passo 'Agente em arquivo único (farol-agente.exe avulso)'
$env:FAROL_MODO = 'onefile'
& $Python -m PyInstaller --noconfirm --distpath (Join-Path $Dist 'onefile') --workpath (Join-Path $Build 'work-agente-onefile') (Join-Path $Emp 'agente\farol-agente.spec'); Checar 'PyInstaller (agente onefile)'

$temBandeja = Test-Path (Join-Path $Raiz 'agente\farol_bandeja.py')
if ($temBandeja) {
  Passo 'Bandeja (sem console)'
  & $Python -m PyInstaller --noconfirm --distpath (Join-Path $Dist 'onedir') --workpath (Join-Path $Build 'work-bandeja') (Join-Path $Emp 'agente\farol-bandeja.spec'); Checar 'PyInstaller (bandeja)'
} else {
  Write-Warning 'agente\farol_bandeja.py não existe: farol-bandeja.exe não será gerado.'
}

if (-not $PularServidor) {
  Passo 'Servidor (Node SEA)'
  Push-Location (Join-Path $Raiz 'servidor'); try { & npm.cmd ci --no-audit --no-fund; Checar 'npm ci (servidor)' } finally { Pop-Location }
  Push-Location (Join-Path $Emp 'servidor'); try {
    & npm.cmd ci --no-audit --no-fund; Checar 'npm ci (empacotamento)'
    & node build.mjs --saida $Dist; Checar 'build do servidor'
  } finally { Pop-Location }
}

Passo 'Assinatura dos executáveis (se houver certificado)'
Assinar @((Join-Path $Dist 'onefile\farol-agente.exe'), (Join-Path $Dist 'onedir\farol-agente\farol-agente.exe'), (Join-Path $Dist 'onedir\farol-bandeja.exe'), (Join-Path $Dist 'farol-servidor.exe'))

if (-not $PularSetup) {
  Passo 'Instalador (Inno Setup)'
  $iscc = $env:ISCC
  if (-not $iscc) {
    $iscc = (Get-Command ISCC.exe -ErrorAction SilentlyContinue).Source
  }
  if (-not $iscc) {
    $iscc = @("${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe", "$env:ProgramFiles\Inno Setup 6\ISCC.exe",
              "$env:LOCALAPPDATA\Programs\Inno Setup 6\ISCC.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1
  }
  if (-not $iscc) { throw 'Inno Setup não encontrado. Instale com: winget install JRSoftware.InnoSetup (ou use -PularSetup).' }
  & $iscc /Qp "/DVersao=$Versao" "/DOrigem=$(Join-Path $Dist 'onedir')" "/DSaida=$Dist" (Join-Path $Emp 'setup\farol.iss'); Checar 'ISCC'
  Assinar @((Join-Path $Dist 'FarolAgenteSetup.exe'))
}

# ---------- pasta final com os nomes fixos do release ----------
Passo 'Reunindo os arquivos finais'
$Rel = Join-Path $Dist 'release'
New-Item -ItemType Directory -Force $Rel | Out-Null
$mapa = [ordered]@{
  'FarolAgenteSetup.exe' = Join-Path $Dist 'FarolAgenteSetup.exe'
  'farol-agente.exe'     = Join-Path $Dist 'onefile\farol-agente.exe'
  'farol-bandeja.exe'    = Join-Path $Dist 'onedir\farol-bandeja.exe'
  'farol-servidor.exe'   = Join-Path $Dist 'farol-servidor.exe'
}
foreach ($nome in $mapa.Keys) {
  if (Test-Path $mapa[$nome]) { Copy-Item $mapa[$nome] (Join-Path $Rel $nome) -Force } else { Write-Warning "$nome não foi gerado" }
}
$linhas = Get-ChildItem $Rel -Filter *.exe | Sort-Object Name | ForEach-Object {
  "$((Get-FileHash $_.FullName -Algorithm SHA256).Hash.ToLower())  $($_.Name)"
}
# SHA256SUMS.txt em UTF-8 sem BOM, formato aceito pelo `sha256sum -c`
[IO.File]::WriteAllText((Join-Path $Rel 'SHA256SUMS.txt'), (($linhas -join "`n") + "`n"), (New-Object Text.UTF8Encoding $false))
Get-ChildItem $Rel | Select-Object Name, @{n = 'MB'; e = { [math]::Round($_.Length / 1MB, 1) } } | Format-Table -AutoSize
Write-Host "Pronto: $Rel" -ForegroundColor Green
