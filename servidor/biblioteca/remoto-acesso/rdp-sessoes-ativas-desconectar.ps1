# ---
# id: rdp-sessoes-ativas-desconectar
# nome: "Desconectar sessões RDP ociosas"
# descricao: "Lista sessões RDP e desconecta as ociosas há mais de N minutos (idle time do query user)."
# categoria: Acesso remoto
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 120
# requer_admin: true
# tags: [rdp, sessoes]
# variaveis:
#   - nome: MINUTOS
#     rotulo: "Ocioso há mais de (min)"
#     tipo: numero
#     padrao: 120
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
$m = Get-Num $env:FAROL_MINUTOS 120; $sim = Test-Simular
$linhas = (query user 2>$null) | Select-Object -Skip 1
if (-not $linhas) { Write-Output "Sem sessões."; exit 0 }
foreach ($l in $linhas) {
  if ($l -match '^\s*>?(\S+)\s+(\S*rdp\S*)\s+(\d+)\s+(\S+)\s+(\S+)\s') {
    $u = $Matches[1]; $id = $Matches[3]; $idle = $Matches[5]
    $min = 0
    if ($idle -match '^(\d+)\+(\d+):(\d+)$') { $min = [int]$Matches[1] * 1440 + [int]$Matches[2] * 60 + [int]$Matches[3] } elseif ($idle -match '^(\d+):(\d+)$') { $min = [int]$Matches[1] * 60 + [int]$Matches[2] } elseif ($idle -match '^\d+$') { $min = [int]$idle }
    if ($min -ge $m) { Write-Output ("{0}{1} (sessão {2}, ocioso {3} min)" -f $(if ($sim) { '[simulação] desconectaria ' } else { 'Desconectando ' }), $u, $id, $min); if (-not $sim) { tsdiscon $id } }
  }
}
exit 0
