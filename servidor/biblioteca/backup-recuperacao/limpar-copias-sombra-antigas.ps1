# ---
# id: limpar-copias-sombra-antigas
# nome: "Remover cópias de sombra antigas"
# descricao: "Exclui cópias de sombra mais antigas que N dias de um volume. Simulação por padrão."
# categoria: Backup e recuperação
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 300
# requer_admin: true
# tags: [vss, limpeza]
# variaveis:
#   - nome: DIAS
#     rotulo: "Remover cópias com mais de (dias)"
#     tipo: numero
#     padrao: 30
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
$lim = (Get-Date).AddDays(-(Get-Num $env:FAROL_DIAS 30)); $sim = Test-Simular
$c = Get-CimInstance Win32_ShadowCopy | Where-Object { $_.InstallDate -lt $lim }
if (-not $c) { Write-Output "Nenhuma cópia anterior a $($lim.ToString('yyyy-MM-dd'))."; exit 0 }
foreach ($x in $c) { Write-Output ("{0}{1} ({2})" -f $(if ($sim) { '[simulação] ' } else { 'Removendo ' }), $x.ID, $x.InstallDate); if (-not $sim) { Remove-CimInstance -InputObject $x } }
exit 0
