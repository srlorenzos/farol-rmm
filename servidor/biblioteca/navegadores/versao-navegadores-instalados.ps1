# ---
# id: versao-navegadores-instalados
# nome: "Versão dos navegadores instalados"
# descricao: "Informa as versões do Chrome, Edge, Firefox e Brave, para checar patches de segurança."
# categoria: Navegadores
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 120
# requer_admin: false
# tags: [navegadores, versao]
# variaveis: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

$alvos = @{ Chrome = 'chrome.exe'; Edge = 'msedge.exe'; Firefox = 'firefox.exe'; Brave = 'brave.exe' }
foreach ($n in $alvos.Keys) {
  $k = "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\$($alvos[$n])"
  $p = (Get-ItemProperty $k -ErrorAction SilentlyContinue).'(default)'
  if (-not $p) { $p = (Get-ItemProperty "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\$($alvos[$n])" -ErrorAction SilentlyContinue).'(default)' }
  if ($p -and (Test-Path $p)) { Write-Output ("{0,-8} {1}" -f $n, (Get-Item $p).VersionInfo.ProductVersion) } else { Write-Output ("{0,-8} não instalado" -f $n) }
}
exit 0
