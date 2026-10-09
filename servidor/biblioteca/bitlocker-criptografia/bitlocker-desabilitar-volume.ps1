# ---
# id: bitlocker-desabilitar-volume
# nome: "Desabilitar BitLocker (descriptografar volume)"
# descricao: "Inicia a descriptografia de um volume. Operação demorada que reduz a segurança; exige confirmação explícita."
# categoria: BitLocker e criptografia
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 300
# requer_admin: true
# tags: [bitlocker, descriptografia]
# variaveis:
#   - nome: UNIDADE
#     rotulo: "Letra da unidade"
#     tipo: texto
#     padrao: ""
#     obrigatorio: true
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
$u = if ("$env:FAROL_UNIDADE" -match '^[A-Za-z]:?$') { $env:FAROL_UNIDADE.Substring(0,1).ToUpper() + ':' } else { Write-Output "Unidade inválida."; exit 1 }
$v = Get-BitLockerVolume -MountPoint $u -ErrorAction Stop
Write-Output "$u : $($v.VolumeStatus) ($($v.EncryptionPercentage)%)"
if (-not (Test-Confirmar)) { Write-Output "Defina CONFIRMAR=true para descriptografar $u."; exit 0 }
Disable-BitLocker -MountPoint $u | Out-Null
Write-Output "Descriptografia iniciada."
exit 0
