# ---
# id: habilitar-uac
# nome: "Habilitar o UAC"
# descricao: "Garante que o Controle de Conta de Usuário (EnableLUA) esteja ligado e com prompt seguro. Requer reinício para ter efeito."
# categoria: Segurança
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 60
# requer_admin: true
# tags: [uac, hardening]
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
$k = 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System'
$p = Get-ItemProperty $k
Write-Output ("EnableLUA={0}; ConsentPromptBehaviorAdmin={1}" -f $p.EnableLUA, $p.ConsentPromptBehaviorAdmin)
if ($p.EnableLUA -eq 1) { Write-Output "UAC já está habilitado."; exit 0 }
if (-not (Test-Confirmar)) { Write-Output "Defina CONFIRMAR=true para habilitar o UAC."; exit 0 }
Set-ItemProperty $k EnableLUA 1 -Type DWord
Set-ItemProperty $k ConsentPromptBehaviorAdmin 5 -Type DWord
Write-Output "UAC habilitado. Reinicie o computador."
exit 0
