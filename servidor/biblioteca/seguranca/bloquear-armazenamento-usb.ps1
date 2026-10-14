# ---
# id: bloquear-armazenamento-usb
# nome: "Bloquear ou liberar armazenamento USB"
# descricao: "Habilita ou desabilita o driver USBSTOR para impedir uso de pendrives e HDs externos. Mouse e teclado não são afetados."
# categoria: Segurança
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 60
# requer_admin: true
# tags: [usb, dlp, hardening]
# variaveis:
#   - nome: ACAO
#     rotulo: "Ação"
#     tipo: selecao
#     padrao: "status"
#     obrigatorio: true
#     opcoes: [status, bloquear, liberar]
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
$k = 'HKLM:\SYSTEM\CurrentControlSet\Services\USBSTOR'
$s = (Get-ItemProperty $k).Start
Write-Output ("USBSTOR Start={0} ({1})" -f $s, $(if ($s -eq 4) { 'BLOQUEADO' } else { 'liberado' }))
$a = "$env:FAROL_ACAO"
if ($a -eq 'status' -or -not $a) { exit 0 }
if (-not (Test-Confirmar)) { Write-Output "Defina CONFIRMAR=true para aplicar '$a'."; exit 0 }
Set-ItemProperty $k Start $(if ($a -eq 'bloquear') { 4 } else { 3 }) -Type DWord
Write-Output "USB armazenamento: $a aplicado."
exit 0
