# ---
# id: limpar-downloads-antigos
# nome: "Limpar pasta Downloads dos usuários"
# descricao: "Remove arquivos da pasta Downloads de cada perfil mais antigos que N dias. Simulação por padrão."
# categoria: Manutenção
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 600
# requer_admin: true
# tags: [downloads, limpeza]
# variaveis:
#   - nome: DIAS
#     rotulo: "Apagar arquivos mais antigos que (dias)"
#     tipo: numero
#     padrao: 60
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
$dias = Get-Num $env:FAROL_DIAS 60
$sim = Test-Simular
if ($sim) { Write-Output "MODO SIMULAÇÃO" }
Get-ChildItem 'C:\Users' -Directory -ErrorAction SilentlyContinue | ForEach-Object {
  Remove-Antigos (Join-Path $_.FullName 'Downloads') $dias $sim
}
exit 0
