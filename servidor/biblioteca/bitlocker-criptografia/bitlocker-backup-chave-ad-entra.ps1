# ---
# id: bitlocker-backup-chave-ad-entra
# nome: "Salvar chave de recuperação no AD ou Entra ID"
# descricao: "Envia as senhas de recuperação do volume do sistema para o Active Directory ou Microsoft Entra ID, conforme o ingresso do dispositivo."
# categoria: BitLocker e criptografia
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 120
# requer_admin: true
# tags: [bitlocker, ad, entra]
# variaveis:
#   - nome: DESTINO
#     rotulo: "Destino"
#     tipo: selecao
#     padrao: "ad"
#     obrigatorio: true
#     opcoes: [ad, entra]
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
$v = Get-BitLockerVolume -MountPoint $env:SystemDrive
$ids = $v.KeyProtector | Where-Object KeyProtectorType -eq 'RecoveryPassword' | ForEach-Object { $_.KeyProtectorId }
if (-not $ids) { Write-Output "Sem protetor RecoveryPassword."; exit 1 }
if (-not (Test-Confirmar)) { Write-Output "Defina CONFIRMAR=true para enviar $(@($ids).Count) protetor(es) para $env:FAROL_DESTINO."; exit 0 }
foreach ($id in $ids) { if ("$env:FAROL_DESTINO" -eq 'entra') { BackupToAAD-BitLockerKeyProtector -MountPoint $env:SystemDrive -KeyProtectorId $id | Out-Null } else { Backup-BitLockerKeyProtector -MountPoint $env:SystemDrive -KeyProtectorId $id | Out-Null } }
Write-Output "Chave(s) enviada(s)."
exit 0
