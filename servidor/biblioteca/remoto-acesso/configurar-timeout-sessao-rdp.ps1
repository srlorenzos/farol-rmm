# ---
# id: configurar-timeout-sessao-rdp
# nome: "Definir limites de sessão RDP"
# descricao: "Configura via política os tempos limite de sessão ociosa e desconectada do RDP."
# categoria: Acesso remoto
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 60
# requer_admin: true
# tags: [rdp, politica]
# variaveis:
#   - nome: OCIOSA_MIN
#     rotulo: "Encerrar ociosa após (min)"
#     tipo: numero
#     padrao: 60
#     obrigatorio: false
#     opcoes: []
#   - nome: DESCONECTADA_MIN
#     rotulo: "Encerrar desconectada após (min)"
#     tipo: numero
#     padrao: 120
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
function Get-Num($v, $padrao) { if ("$v" -match '^\d+$') { [int]$v } else { $padrao } }
function Test-Admin { ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator) }
function Exigir-Admin { if (-not (Test-Admin)) { Write-Output 'ERRO: este script precisa ser executado como administrador.'; exit 1 } }
function Test-Confirmar { "$env:FAROL_CONFIRMAR" -match '^(1|true|sim|s|yes|y|verdadeiro)$' }

Exigir-Admin
if (-not (Test-Confirmar)) { Write-Output "Defina CONFIRMAR=true para aplicar."; exit 0 }
$k = 'HKLM:\SOFTWARE\Policies\Microsoft\Windows NT\Terminal Services'
New-Item $k -Force | Out-Null
Set-ItemProperty $k MaxIdleTime ((Get-Num $env:FAROL_OCIOSA_MIN 60) * 60000) -Type DWord
Set-ItemProperty $k MaxDisconnectionTime ((Get-Num $env:FAROL_DESCONECTADA_MIN 120) * 60000) -Type DWord
Write-Output "Limites aplicados."
exit 0
