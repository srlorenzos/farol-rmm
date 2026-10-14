# ---
# id: mon-administradores-locais-qtde
# nome: "Monitor - quantidade de administradores locais"
# descricao: "Alerta se o grupo Administradores local tem mais membros que o esperado (escalonamento de privilégio)."
# categoria: Monitoramento
# so: [windows]
# shell: powershell
# tipo: monitor
# tempo_limite: 60
# requer_admin: false
# tags: [admin, seguranca, monitor]
# variaveis:
#   - nome: MAXIMO
#     rotulo: "Máximo esperado"
#     tipo: numero
#     padrao: 3
#     obrigatorio: false
#     opcoes: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function Get-Num($v, $padrao) { if ("$v" -match '^\d+$') { [int]$v } else { $padrao } }
function Out-Status($nivel, $msg) { Write-Output "FAROL_STATUS: $nivel $msg" }

$max = Get-Num $env:FAROL_MAXIMO 3
$m = @(Get-LocalGroupMember -SID 'S-1-5-32-544' -ErrorAction SilentlyContinue)
$nomes = ($m | ForEach-Object { $_.Name }) -join ', '
if ($m.Count -gt $max) { Out-Status 'alerta' "$($m.Count) administradores (máx. $max): $nomes" } else { Out-Status 'ok' "$($m.Count) administrador(es): $nomes" }
exit 0
