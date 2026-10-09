# ---
# id: gerenciar-recursos-windows
# nome: "Habilitar ou desabilitar recursos opcionais do Windows"
# descricao: "Lista recursos opcionais ou habilita/desabilita um específico (ex.: NetFx3, Microsoft-Hyper-V-All, Microsoft-Windows-Subsystem-Linux, TelnetClient)."
# categoria: Software
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 1200
# requer_admin: true
# tags: [recursos, dism]
# variaveis:
#   - nome: RECURSO
#     rotulo: "Nome do recurso (vazio = listar habilitados)"
#     tipo: texto
#     padrao: ""
#     obrigatorio: false
#     opcoes: []
#   - nome: ACAO
#     rotulo: "Ação"
#     tipo: selecao
#     padrao: "habilitar"
#     obrigatorio: false
#     opcoes: [habilitar, desabilitar]
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
$r = "$env:FAROL_RECURSO".Trim()
if (-not $r) { Get-WindowsOptionalFeature -Online | Where-Object State -eq 'Enabled' | Select-Object FeatureName | Format-Table -AutoSize | Out-String | Write-Output; exit 0 }
if ($r -notmatch '^[\w.-]+$') { Write-Output "Nome inválido."; exit 1 }
$f = Get-WindowsOptionalFeature -Online -FeatureName $r -ErrorAction SilentlyContinue
if (-not $f) { Write-Output "Recurso não encontrado."; exit 1 }
Write-Output "${r}: $($f.State)"
if (-not (Test-Confirmar)) { Write-Output "Defina CONFIRMAR=true para alterar."; exit 0 }
if ("$env:FAROL_ACAO" -eq 'desabilitar') { Disable-WindowsOptionalFeature -Online -FeatureName $r -NoRestart | Out-Null } else { Enable-WindowsOptionalFeature -Online -FeatureName $r -All -NoRestart | Out-Null }
Write-Output "Concluído (pode exigir reinício)."
exit 0
