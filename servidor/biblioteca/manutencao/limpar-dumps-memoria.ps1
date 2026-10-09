# ---
# id: limpar-dumps-memoria
# nome: "Remover dumps de memória e minidumps"
# descricao: "Apaga MEMORY.DMP, minidumps e LiveKernelReports. Mostra o que seria removido por padrão."
# categoria: Manutenção
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 120
# requer_admin: true
# tags: [dump, bsod, limpeza]
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
$itens = @()
if (Test-Path "$env:windir\MEMORY.DMP") { $itens += Get-Item "$env:windir\MEMORY.DMP" -Force }
foreach ($p in "$env:windir\Minidump", "$env:windir\LiveKernelReports") {
  if (Test-Path $p) { $itens += Get-ChildItem $p -Recurse -Force -File -Include *.dmp -ErrorAction SilentlyContinue }
}
$itens | ForEach-Object { Write-Output ("{0}  {1}" -f $_.FullName, (Format-Tam $_.Length)) }
Write-Output ("Total: {0} arquivo(s), {1}" -f $itens.Count, (Format-Tam ([int64](($itens | Measure-Object Length -Sum).Sum))))
if ($sim) { Write-Output "SIMULAÇÃO: nada removido."; exit 0 }
$itens | Remove-Item -Force -ErrorAction SilentlyContinue
Write-Output "Dumps removidos."
exit 0
