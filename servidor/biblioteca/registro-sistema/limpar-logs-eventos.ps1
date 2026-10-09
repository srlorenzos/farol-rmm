# ---
# id: limpar-logs-eventos
# nome: "Arquivar e limpar logs de eventos"
# descricao: "Exporta (evtx) e limpa logs de eventos selecionados. Por padrão apenas lista; limpeza exige confirmação e arquiva antes."
# categoria: Registro e logs do sistema
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 600
# requer_admin: true
# tags: [logs, eventos, limpeza]
# variaveis:
#   - nome: LOGS
#     rotulo: "Logs separados por vírgula"
#     tipo: texto
#     padrao: "Application,System"
#     obrigatorio: false
#     opcoes: []
#   - nome: ARQUIVAR_EM
#     rotulo: "Pasta para arquivar antes de limpar"
#     tipo: texto
#     padrao: "C:\\Windows\\Temp\\evtx"
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
function Test-Admin { ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator) }
function Exigir-Admin { if (-not (Test-Admin)) { Write-Output 'ERRO: este script precisa ser executado como administrador.'; exit 1 } }
function Format-Tam($b) { if ($b -ge 1GB) { '{0:N2} GB' -f ($b / 1GB) } elseif ($b -ge 1MB) { '{0:N1} MB' -f ($b / 1MB) } else { '{0:N0} KB' -f ($b / 1KB) } }
function Test-Confirmar { "$env:FAROL_CONFIRMAR" -match '^(1|true|sim|s|yes|y|verdadeiro)$' }

Exigir-Admin
$logs = ("$env:FAROL_LOGS" -replace '\s', '').Split(',') | Where-Object { $_ -match '^[\w\-/]+$' }
if (-not $logs) { $logs = 'Application', 'System' }
if ($logs -contains 'Security') { Write-Output "O log Security não pode ser limpo por este script (preservação de auditoria)."; $logs = $logs | Where-Object { $_ -ne 'Security' } }
$dir = if ($env:FAROL_ARQUIVAR_EM) { $env:FAROL_ARQUIVAR_EM } else { "$env:windir\Temp\evtx" }
foreach ($l in $logs) {
  $i = Get-WinEvent -ListLog $l -ErrorAction SilentlyContinue
  if (-not $i) { Write-Output "Log inexistente: $l"; continue }
  Write-Output ("{0}: {1} registros, {2}" -f $l, $i.RecordCount, (Format-Tam $i.FileSize))
  if (Test-Confirmar) {
    New-Item $dir -ItemType Directory -Force | Out-Null
    $arq = Join-Path $dir ("{0}-{1:yyyyMMdd-HHmm}.evtx" -f ($l -replace '[\\/]', '_'), (Get-Date))
    wevtutil epl $l $arq; wevtutil cl $l; Write-Output "  arquivado em $arq e limpo"
  }
}
if (-not (Test-Confirmar)) { Write-Output "Nada alterado. Defina CONFIRMAR=true para arquivar e limpar." }
exit 0
