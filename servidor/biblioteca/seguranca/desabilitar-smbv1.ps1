# ---
# id: desabilitar-smbv1
# nome: "Desabilitar SMBv1"
# descricao: "Desabilita o protocolo SMBv1 (servidor e cliente), vulnerável a WannaCry/EternalBlue. Mostra o estado atual e só altera com confirmação."
# categoria: Segurança
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 180
# requer_admin: true
# tags: [smb, hardening, wannacry]
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
$srv = (Get-SmbServerConfiguration).EnableSMB1Protocol
$f = Get-WindowsOptionalFeature -Online -FeatureName SMB1Protocol -ErrorAction SilentlyContinue
Write-Output "Servidor SMB1: $srv; recurso: $($f.State)"
if (-not $srv -and $f.State -ne 'Enabled') { Write-Output "SMBv1 já está desabilitado."; exit 0 }
if (-not (Test-Confirmar)) { Write-Output "Defina CONFIRMAR=true para desabilitar SMBv1."; exit 0 }
Set-SmbServerConfiguration -EnableSMB1Protocol $false -Force
Disable-WindowsOptionalFeature -Online -FeatureName SMB1Protocol -NoRestart -ErrorAction SilentlyContinue | Out-Null
Write-Output "SMBv1 desabilitado. Pode exigir reinício."
exit 0
