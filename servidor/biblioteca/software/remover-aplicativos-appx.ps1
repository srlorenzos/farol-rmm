# ---
# id: remover-aplicativos-appx
# nome: "Remover aplicativos AppX indesejados"
# descricao: "Remove aplicativos pré-instalados (bloatware) por nome, como Xbox, Solitaire, Clipchamp, Cortana. Mostra o que seria removido por padrão."
# categoria: Software
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 600
# requer_admin: true
# tags: [appx, bloatware]
# variaveis:
#   - nome: PADROES
#     rotulo: "Padrões de nome separados por vírgula"
#     tipo: texto
#     padrao: "*Solitaire*,*ZuneMusic*,*ZuneVideo*,*BingNews*,*BingWeather*,*GetHelp*,*Clipchamp*,*YourPhone*"
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
function Test-Admin { ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator) }
function Exigir-Admin { if (-not (Test-Admin)) { Write-Output 'ERRO: este script precisa ser executado como administrador.'; exit 1 } }
function Test-Simular { -not ("$env:FAROL_SIMULAR" -match '^(0|false|nao|não|n|no|falso)$') }

Exigir-Admin
$sim = Test-Simular
$pad = if ($env:FAROL_PADROES) { $env:FAROL_PADROES } else { '*Solitaire*,*ZuneMusic*,*ZuneVideo*,*BingNews*,*BingWeather*,*GetHelp*,*Clipchamp*,*YourPhone*' }
foreach ($p in ($pad -replace '\s', '').Split(',')) {
  if ($p -notmatch '^[\w*.-]+$' -or $p -match '^\**$') { continue }
  Get-AppxPackage -AllUsers -Name $p -ErrorAction SilentlyContinue | ForEach-Object {
    Write-Output ("{0}{1}" -f $(if ($sim) { '[simulação] ' } else { 'Removendo ' }), $_.Name)
    if (-not $sim) { Remove-AppxPackage -Package $_.PackageFullName -AllUsers -ErrorAction SilentlyContinue }
  }
}
exit 0
