# ---
# id: testar-conectividade
# nome: "Testar conectividade (ping)"
# descricao: "Envia pings a uma lista de hosts e reporta perda e latência média de cada um."
# categoria: Rede
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 120
# requer_admin: false
# tags: [rede, ping, latencia]
# variaveis:
#   - nome: HOSTS
#     rotulo: "Hosts separados por vírgula"
#     tipo: texto
#     padrao: "8.8.8.8,1.1.1.1,google.com"
#     obrigatorio: false
#     opcoes: []
#   - nome: PACOTES
#     rotulo: "Pacotes por host"
#     tipo: numero
#     padrao: 4
#     obrigatorio: false
#     opcoes: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function Get-Num($v, $padrao) { if ("$v" -match '^\d+$') { [int]$v } else { $padrao } }

$hosts = ("$env:FAROL_HOSTS" -replace '\s', '').Split(',') | Where-Object { $_ }
if (-not $hosts) { $hosts = '8.8.8.8','1.1.1.1','google.com' }
$n = Get-Num $env:FAROL_PACOTES 4
foreach ($h in $hosts) {
  if ($h -notmatch '^[A-Za-z0-9._:-]+$') { Write-Output "Host inválido ignorado: $h"; continue }
  $r = Test-Connection -ComputerName $h -Count $n -ErrorAction SilentlyContinue
  if ($r) { $ok = @($r).Count; $med = [math]::Round((($r | Measure-Object ResponseTime -Average).Average), 1); Write-Output ("{0,-30} respostas {1}/{2}  média {3} ms" -f $h, $ok, $n, $med) }
  else { Write-Output ("{0,-30} SEM RESPOSTA" -f $h) }
}
exit 0
