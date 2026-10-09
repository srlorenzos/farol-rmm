# ---
# id: corrigir-erro-impressao-rede
# nome: "Corrigir erros de impressão em rede (0x0000011b / 0x00000709)"
# descricao: "Ajusta RpcAuthnLevelPrivacyEnabled e a política de Point and Print para restabelecer impressão em compartilhamentos de rede após as atualizações de segurança do spooler."
# categoria: Impressoras
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 60
# requer_admin: true
# tags: [impressao, 0x11b, spooler]
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
$k1 = 'HKLM:\SYSTEM\CurrentControlSet\Control\Print'; $k2 = 'HKLM:\SOFTWARE\Policies\Microsoft\Windows NT\Printers\PointAndPrint'
Write-Output ("RpcAuthnLevelPrivacyEnabled: {0}" -f (Get-ItemProperty $k1 -ErrorAction SilentlyContinue).RpcAuthnLevelPrivacyEnabled)
if (-not (Test-Confirmar)) { Write-Output "Defina CONFIRMAR=true. Atenção: reduz a segurança do RPC de impressão; use apenas se o servidor de impressão não puder ser corrigido."; exit 0 }
Set-ItemProperty $k1 RpcAuthnLevelPrivacyEnabled 0 -Type DWord
if (-not (Test-Path $k2)) { New-Item $k2 -Force | Out-Null }
Set-ItemProperty $k2 RestrictDriverInstallationToAdministrators 0 -Type DWord
Restart-Service Spooler -Force
Write-Output "Ajustes aplicados e spooler reiniciado."
exit 0
