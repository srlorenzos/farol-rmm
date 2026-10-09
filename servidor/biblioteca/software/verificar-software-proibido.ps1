# ---
# id: verificar-software-proibido
# nome: "Detectar software não autorizado"
# descricao: "Procura na lista de programas instalados por nomes proibidos (ex.: torrent, crack, VPN gratuita, remote tools não homologadas)."
# categoria: Software
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 120
# requer_admin: false
# tags: [software, compliance]
# variaveis:
#   - nome: LISTA
#     rotulo: "Termos separados por vírgula"
#     tipo: texto
#     padrao: "utorrent,bittorrent,qbittorrent,teamviewer,anydesk,ultraviewer,crack,keygen,hola vpn"
#     obrigatorio: false
#     opcoes: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

$l = if ($env:FAROL_LISTA) { $env:FAROL_LISTA } else { 'utorrent,bittorrent,qbittorrent,teamviewer,anydesk,ultraviewer,crack,keygen' }
$termos = $l.Split(',') | ForEach-Object { $_.Trim() } | Where-Object { $_ }
$ks = 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*', 'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*', 'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*'
$ins = Get-ItemProperty $ks -ErrorAction SilentlyContinue | Where-Object DisplayName
$ach = foreach ($t in $termos) { $ins | Where-Object { $_.DisplayName -like "*$t*" } | ForEach-Object { [pscustomobject]@{ Termo = $t; Programa = $_.DisplayName; Versao = $_.DisplayVersion } } }
if (-not $ach) { Write-Output "Nenhum software da lista encontrado."; exit 0 }
$ach | Format-Table -AutoSize | Out-String | Write-Output
Write-Output "ATENÇÃO: $(@($ach).Count) item(ns) encontrado(s)."
exit 0
