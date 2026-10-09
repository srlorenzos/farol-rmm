# ---
# id: mon-servico-parado
# nome: "Monitor - serviços específicos em execução"
# descricao: "Verifica se os serviços listados estão em execução; crítico se algum estiver parado."
# categoria: Monitoramento
# so: [windows]
# shell: powershell
# tipo: monitor
# tempo_limite: 60
# requer_admin: false
# tags: [servicos, monitor]
# variaveis:
#   - nome: SERVICOS
#     rotulo: "Nomes de serviço separados por vírgula"
#     tipo: texto
#     padrao: "Spooler,W32Time"
#     obrigatorio: true
#     opcoes: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function Out-Status($nivel, $msg) { Write-Output "FAROL_STATUS: $nivel $msg" }

$lista = ("$env:FAROL_SERVICOS" -replace '\s', '').Split(',') | Where-Object { $_ -match '^[\w.$-]+$' }
if (-not $lista) { Write-Output "Informe SERVICOS."; exit 2 }
$par = @(); $ausente = @()
foreach ($n in $lista) { $s = Get-Service -Name $n -ErrorAction SilentlyContinue; if (-not $s) { $ausente += $n } elseif ($s.Status -ne 'Running') { $par += "$n($($s.Status))" } }
if ($par -or $ausente) { Out-Status 'critico' ("Parados: " + ($par -join ', ') + $(if ($ausente) { " | Inexistentes: " + ($ausente -join ', ') })) } else { Out-Status 'ok' ("Em execução: " + ($lista -join ', ')) }
exit 0
