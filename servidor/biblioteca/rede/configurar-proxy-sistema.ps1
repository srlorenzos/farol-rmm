# ---
# id: configurar-proxy-sistema
# nome: "Configurar proxy do sistema"
# descricao: "Define o proxy WinHTTP do sistema e o proxy do usuário atual (WinINET), com lista de exceções."
# categoria: Rede
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 60
# requer_admin: true
# tags: [proxy, configuracao]
# variaveis:
#   - nome: PROXY
#     rotulo: "Proxy (host:porta)"
#     tipo: texto
#     padrao: ""
#     obrigatorio: true
#     opcoes: []
#   - nome: EXCECOES
#     rotulo: "Exceções separadas por ponto e vírgula"
#     tipo: texto
#     padrao: "<local>"
#     obrigatorio: false
#     opcoes: []
#   - nome: CONFIRMAR
#     rotulo: "Digite true para confirmar a execução"
#     tipo: booleano
#     padrao: false
#     obrigatorio: false
#     opcoes: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function Test-Admin { ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator) }
function Exigir-Admin { if (-not (Test-Admin)) { Write-Output 'ERRO: este script precisa ser executado como administrador.'; exit 1 } }
function Test-Confirmar { "$env:FAROL_CONFIRMAR" -match '^(1|true|sim|s|yes|y|verdadeiro)$' }

Exigir-Admin
$p = "$env:FAROL_PROXY".Trim()
if ($p -notmatch '^[A-Za-z0-9._-]+:\d{1,5}$') { Write-Output "Formato inválido; use host:porta."; exit 1 }
$ex = if ($env:FAROL_EXCECOES) { $env:FAROL_EXCECOES } else { '<local>' }
if (-not (Test-Confirmar)) { Write-Output "Defina CONFIRMAR=true para aplicar o proxy $p."; exit 0 }
netsh winhttp set proxy proxy-server="$p" bypass-list="$ex"
$k = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings'
Set-ItemProperty $k ProxyEnable 1; Set-ItemProperty $k ProxyServer $p; Set-ItemProperty $k ProxyOverride $ex
Write-Output "Proxy aplicado."
exit 0
