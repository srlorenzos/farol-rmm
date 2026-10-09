# ---
# id: bitlocker-suspender-retomar
# nome: "Suspender ou retomar proteção do BitLocker"
# descricao: "Suspende a proteção por N reinícios (ex.: para atualizar BIOS) ou a retoma."
# categoria: BitLocker e criptografia
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 60
# requer_admin: true
# tags: [bitlocker, bios]
# variaveis:
#   - nome: ACAO
#     rotulo: "Ação"
#     tipo: selecao
#     padrao: "suspender"
#     obrigatorio: true
#     opcoes: [suspender, retomar]
#   - nome: REINICIOS
#     rotulo: "Reinícios com proteção suspensa"
#     tipo: numero
#     padrao: 1
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
if (-not (Test-Confirmar)) { Write-Output "Defina CONFIRMAR=true para $env:FAROL_ACAO."; exit 0 }
if ("$env:FAROL_ACAO" -eq 'retomar') { Resume-BitLocker -MountPoint $env:SystemDrive | Out-Null; Write-Output "Proteção retomada." }
else { Suspend-BitLocker -MountPoint $env:SystemDrive -RebootCount ([math]::Min((Get-Num $env:FAROL_REINICIOS 1), 15)) | Out-Null; Write-Output "Proteção suspensa temporariamente." }
exit 0
