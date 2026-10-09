# ---
# id: limpar-relatorios-erro-windows
# nome: "Limpar relatórios de erro do Windows (WER)"
# descricao: "Remove relatórios de erro e arquivos de fila do Windows Error Reporting, que podem ocupar vários GB."
# categoria: Manutenção
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 300
# requer_admin: true
# tags: [wer, limpeza]
# variaveis:
#   - nome: SIMULAR
#     rotulo: "Modo simulação (não altera nada; use false para aplicar)"
#     tipo: booleano
#     padrao: true
#     obrigatorio: false
#     opcoes: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function Test-Admin { ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator) }
function Exigir-Admin { if (-not (Test-Admin)) { Write-Output 'ERRO: este script precisa ser executado como administrador.'; exit 1 } }
function Format-Tam($b) { if ($b -ge 1GB) { '{0:N2} GB' -f ($b / 1GB) } elseif ($b -ge 1MB) { '{0:N1} MB' -f ($b / 1MB) } else { '{0:N0} KB' -f ($b / 1KB) } }
function Test-Simular { -not ("$env:FAROL_SIMULAR" -match '^(0|false|nao|não|n|no|falso)$') }

Exigir-Admin
$sim = Test-Simular
$pastas = "$env:ProgramData\Microsoft\Windows\WER\ReportArchive", "$env:ProgramData\Microsoft\Windows\WER\ReportQueue", "$env:ProgramData\Microsoft\Windows\WER\Temp"
foreach ($p in $pastas) {
  if (Test-Path $p) {
    $t = (Get-ChildItem $p -Recurse -Force -File -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum
    Write-Output ("{0}: {1}" -f $p, (Format-Tam ([int64]$t)))
    if (-not $sim) { Get-ChildItem $p -Force -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue }
  }
}
if ($sim) { Write-Output "SIMULAÇÃO: nada removido." }
exit 0
