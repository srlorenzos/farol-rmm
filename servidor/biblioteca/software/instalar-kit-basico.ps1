# ---
# id: instalar-kit-basico
# nome: "Instalar kit básico de aplicativos"
# descricao: "Instala via winget um conjunto escolhido de aplicativos comuns (7-Zip, Chrome, Firefox, VLC, Notepad++, Adobe Reader, Zoom...). Informe as chaves desejadas."
# categoria: Software
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 3600
# requer_admin: true
# tags: [winget, onboarding, kit]
# variaveis:
#   - nome: ITENS
#     rotulo: "Itens separados por vírgula (7zip,chrome,firefox,vlc,notepadpp,acrobat,zoom,teams,edge,anydesk,putty,vscode)"
#     tipo: texto
#     padrao: "7zip,chrome,vlc"
#     obrigatorio: true
#     opcoes: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

$mapa = @{ '7zip' = '7zip.7zip'; 'chrome' = 'Google.Chrome'; 'firefox' = 'Mozilla.Firefox'; 'vlc' = 'VideoLAN.VLC'; 'notepadpp' = 'Notepad++.Notepad++'; 'acrobat' = 'Adobe.Acrobat.Reader.64-bit'; 'zoom' = 'Zoom.Zoom'; 'teams' = 'Microsoft.Teams'; 'edge' = 'Microsoft.Edge'; 'anydesk' = 'AnyDeskSoftwareGmbH.AnyDesk'; 'putty' = 'PuTTY.PuTTY'; 'vscode' = 'Microsoft.VisualStudioCode' }
$w = Get-Command winget.exe -ErrorAction SilentlyContinue
if (-not $w) { $w = Get-ChildItem "$env:ProgramFiles\WindowsApps\Microsoft.DesktopAppInstaller_*\winget.exe" -ErrorAction SilentlyContinue | Sort-Object Name -Descending | Select-Object -First 1 }
if (-not $w) { Write-Output "winget não encontrado."; exit 1 }
$exe = if ($w.Source) { $w.Source } else { $w.FullName }
$falhas = 0
foreach ($k in ("$env:FAROL_ITENS" -replace '\s', '').ToLower().Split(',')) {
  if (-not $mapa.ContainsKey($k)) { Write-Output "Item desconhecido ignorado: $k"; continue }
  Write-Output "== $k ($($mapa[$k])) =="
  & $exe install --id $mapa[$k] --exact --silent --accept-package-agreements --accept-source-agreements --scope machine --disable-interactivity 2>&1 | Select-Object -Last 2
  if ($LASTEXITCODE -ne 0 -and $LASTEXITCODE -ne -1978335189) { $falhas++ }
}
Write-Output "Concluído com $falhas falha(s)."
exit $(if ($falhas) { 1 } else { 0 })
