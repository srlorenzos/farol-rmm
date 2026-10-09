# ---
# id: limpar-perfis-inativos
# nome: "Remover perfis de usuário inativos"
# descricao: "Lista (e opcionalmente remove) perfis locais sem uso há N dias, ignorando contas de sistema e o usuário logado. Simulação por padrão."
# categoria: Manutenção
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 900
# requer_admin: true
# tags: [perfis, limpeza, usuarios]
# variaveis:
#   - nome: DIAS
#     rotulo: "Inativo há mais de (dias)"
#     tipo: numero
#     padrao: 90
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
function Test-Simular { -not ("$env:FAROL_SIMULAR" -match '^(0|false|nao|não|n|no|falso)$') }

Exigir-Admin
$dias = Get-Num $env:FAROL_DIAS 90
$sim = Test-Simular
$lim = (Get-Date).AddDays(-$dias)
$perfis = Get-CimInstance Win32_UserProfile | Where-Object { -not $_.Special -and -not $_.Loaded -and $_.LocalPath -like 'C:\Users\*' }
$cand = foreach ($p in $perfis) {
  $uso = $null
  $uso = $p.LastUseTime
  if ($uso -and $uso -lt $lim) { [pscustomobject]@{ Perfil = $p.LocalPath; UltimoUso = $uso; Obj = $p } }
}
if (-not $cand) { Write-Output "Nenhum perfil inativo há mais de $dias dias."; exit 0 }
$cand | Select-Object Perfil, UltimoUso | Format-Table -AutoSize | Out-String | Write-Output
if ($sim) { Write-Output "SIMULAÇÃO: nenhum perfil removido."; exit 0 }
foreach ($c in $cand) {
  try { Remove-CimInstance -InputObject $c.Obj -ErrorAction Stop; Write-Output "Removido: $($c.Perfil)" } catch { Write-Output "Falha em $($c.Perfil): $($_.Exception.Message)" }
}
exit 0
