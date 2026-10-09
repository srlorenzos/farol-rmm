# ---
# id: esvaziar-lixeira
# nome: "Esvaziar lixeira de todos os usuários"
# descricao: "Esvazia a Lixeira de todas as unidades. Modo simulação por padrão mostra o tamanho ocupado."
# categoria: Manutenção
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 120
# requer_admin: true
# tags: [lixeira, limpeza]
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
$tot = 0
Get-PSDrive -PSProvider FileSystem | ForEach-Object {
  $r = Join-Path $_.Root '$Recycle.Bin'
  if (Test-Path $r) {
    $t = (Get-ChildItem $r -Recurse -Force -File -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum
    $tot += [int64]$t
    Write-Output ("{0} {1}" -f $r, (Format-Tam ([int64]$t)))
  }
}
if (Test-Simular) { Write-Output ("SIMULAÇÃO: seriam liberados {0}." -f (Format-Tam $tot)); exit 0 }
Clear-RecycleBin -Force -ErrorAction SilentlyContinue
Get-PSDrive -PSProvider FileSystem | ForEach-Object {
  $r = Join-Path $_.Root '$Recycle.Bin'
  if (Test-Path $r) { Get-ChildItem $r -Force -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue }
}
Write-Output ("Lixeira esvaziada: {0} liberados." -f (Format-Tam $tot))
exit 0
