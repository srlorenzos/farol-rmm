# ---
# id: reiniciar-componentes-windows-update
# nome: "Reiniciar componentes do Windows Update"
# descricao: "Para serviços, renomeia SoftwareDistribution e catroot2, re-registra DLLs e reinicia os serviços. Corrige erros 0x8024xxxx persistentes."
# categoria: Atualizações
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 600
# requer_admin: true
# tags: [windows-update, reparo]
# variaveis:
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
if (-not (Test-Confirmar)) { Write-Output "Defina CONFIRMAR=true para redefinir os componentes do Windows Update."; exit 0 }
$svc = 'wuauserv', 'cryptSvc', 'bits', 'msiserver'
$svc | ForEach-Object { Stop-Service $_ -Force -ErrorAction SilentlyContinue }
$ts = Get-Date -Format yyyyMMddHHmm
Rename-Item "$env:windir\SoftwareDistribution" "SoftwareDistribution.bak$ts" -ErrorAction SilentlyContinue
Rename-Item "$env:windir\System32\catroot2" "catroot2.bak$ts" -ErrorAction SilentlyContinue
foreach ($d in 'atl.dll', 'urlmon.dll', 'mshtml.dll', 'shdocvw.dll', 'jscript.dll', 'vbscript.dll', 'scrrun.dll', 'msxml3.dll', 'msxml6.dll', 'wuapi.dll', 'wuaueng.dll', 'wups.dll', 'wups2.dll', 'wuweb.dll') { regsvr32.exe /s "$env:windir\System32\$d" }
netsh winsock reset | Out-Null
$svc | ForEach-Object { Start-Service $_ -ErrorAction SilentlyContinue }
Write-Output "Componentes redefinidos. Execute uma nova busca de atualizações."
exit 0
