# ---
# id: relatorio-energia-powercfg
# nome: "Relatório de energia e eficiência"
# descricao: "Gera o relatório powercfg /energy (60 s) e resume erros e avisos encontrados."
# categoria: Energia
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 240
# requer_admin: true
# tags: [energia, powercfg]
# variaveis: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function Test-Admin { ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator) }
function Exigir-Admin { if (-not (Test-Admin)) { Write-Output 'ERRO: este script precisa ser executado como administrador.'; exit 1 } }

Exigir-Admin
$f = Join-Path $env:TEMP 'farol-energy.xml'
powercfg /energy /duration 60 /xml /output $f | Out-Null
if (-not (Test-Path $f)) { Write-Output "Não foi possível gerar o relatório."; exit 1 }
[xml]$x = Get-Content $f
$x.EnergyReport.Problems.Problem | Where-Object { $_.Name } | Select-Object -First 25 | ForEach-Object { Write-Output ("[{0}] {1}" -f $_.Severity, $_.Name) }
Remove-Item $f -Force
exit 0
