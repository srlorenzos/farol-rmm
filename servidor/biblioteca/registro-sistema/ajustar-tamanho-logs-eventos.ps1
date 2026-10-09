# ---
# id: ajustar-tamanho-logs-eventos
# nome: "Ajustar tamanho máximo dos logs de eventos"
# descricao: "Define o tamanho máximo (MB) dos logs Application, System e Security para retenção adequada de auditoria."
# categoria: Registro e logs do sistema
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 60
# requer_admin: true
# tags: [logs, retencao]
# variaveis:
#   - nome: TAMANHO_MB
#     rotulo: "Tamanho máximo (MB)"
#     tipo: numero
#     padrao: 256
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
$mb = Get-Num $env:FAROL_TAMANHO_MB 256
foreach ($l in 'Application', 'System', 'Security') {
  $i = Get-WinEvent -ListLog $l
  Write-Output ("{0}: {1} MB atual" -f $l, [math]::Round($i.MaximumSizeInBytes / 1MB))
  if (Test-Confirmar) { wevtutil sl $l /ms:$($mb * 1MB) }
}
if (-not (Test-Confirmar)) { Write-Output "Defina CONFIRMAR=true para aplicar $mb MB." } else { Write-Output "Tamanho definido para $mb MB." }
exit 0
