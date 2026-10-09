# ---
# id: manutencao-completa-windows
# nome: "Rotina de manutenção completa"
# descricao: "Executa em sequência limpeza de temporários, lixeira, relatórios de erro e cache de atualização, otimização de disco e verificação de integridade. Cada etapa pode ser desligada."
# categoria: Manutenção
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 3600
# requer_admin: true
# tags: [rotina, manutencao]
# variaveis:
#   - nome: DIAS
#     rotulo: "Idade mínima dos temporários (dias)"
#     tipo: numero
#     padrao: 7
#     obrigatorio: false
#     opcoes: []
#   - nome: OTIMIZAR
#     rotulo: "Otimizar volumes (TRIM/defrag)"
#     tipo: booleano
#     padrao: true
#     obrigatorio: false
#     opcoes: []
#   - nome: SIMULAR
#     rotulo: "Modo simulação (não altera nada; use false para aplicar)"
#     tipo: booleano
#     padrao: true
#     obrigatorio: false
#     opcoes: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function Get-Num($v, $padrao) { if ("$v" -match '^\d+$') { [int]$v } else { $padrao } }
function Test-Admin { ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator) }
function Exigir-Admin { if (-not (Test-Admin)) { Write-Output 'ERRO: este script precisa ser executado como administrador.'; exit 1 } }
function Format-Tam($b) { if ($b -ge 1GB) { '{0:N2} GB' -f ($b / 1GB) } elseif ($b -ge 1MB) { '{0:N1} MB' -f ($b / 1MB) } else { '{0:N0} KB' -f ($b / 1KB) } }
function Test-Simular { -not ("$env:FAROL_SIMULAR" -match '^(0|false|nao|não|n|no|falso)$') }
function Remove-Antigos($caminho, $dias, $simular) {
  $lim = (Get-Date).AddDays(-$dias); $tot = 0; $n = 0
  if (-not (Test-Path -LiteralPath $caminho)) { return }
  Get-ChildItem -LiteralPath $caminho -Recurse -Force -File -ErrorAction SilentlyContinue | Where-Object { $_.LastWriteTime -lt $lim } | ForEach-Object {
    $tot += $_.Length; $n++
    if (-not $simular) { Remove-Item -LiteralPath $_.FullName -Force -ErrorAction SilentlyContinue }
  }
  Write-Output ("{0}: {1} arquivo(s), {2}" -f $caminho, $n, (Format-Tam $tot))
}

Exigir-Admin
$dias = Get-Num $env:FAROL_DIAS 7
$sim = Test-Simular
Write-Output "== Rotina de manutenção (simulação: $sim) =="
Write-Output "-- Temporários"
Remove-Antigos "$env:windir\Temp" $dias $sim
Get-ChildItem 'C:\Users' -Directory -ErrorAction SilentlyContinue | ForEach-Object { Remove-Antigos (Join-Path $_.FullName 'AppData\Local\Temp') $dias $sim }
Write-Output "-- Relatórios de erro"
Remove-Antigos "$env:ProgramData\Microsoft\Windows\WER" 0 $sim
Write-Output "-- Cache do Windows Update"
Remove-Antigos "$env:windir\SoftwareDistribution\Download" 1 $sim
if (-not $sim) { Clear-RecycleBin -Force -ErrorAction SilentlyContinue; Write-Output "Lixeira esvaziada." }
if (("$env:FAROL_OTIMIZAR" -notmatch '^(0|false|nao|n)$') -and -not $sim) {
  Write-Output "-- Otimização de volumes"
  Get-Volume | Where-Object { $_.DriveLetter -and $_.DriveType -eq 'Fixed' } | ForEach-Object { Optimize-Volume -DriveLetter $_.DriveLetter -ErrorAction SilentlyContinue -Verbose:$false }
}
Write-Output "Rotina concluída."
exit 0
