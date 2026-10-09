# ---
# id: mon-processo-em-execucao
# nome: "Monitor - processo obrigatório em execução"
# descricao: "Verifica se processos obrigatórios (agente de backup, antivírus, EDR) estão rodando."
# categoria: Monitoramento
# so: [windows]
# shell: powershell
# tipo: monitor
# tempo_limite: 60
# requer_admin: false
# tags: [processos, monitor]
# variaveis:
#   - nome: PROCESSOS
#     rotulo: "Nomes de processo (sem .exe) separados por vírgula"
#     tipo: texto
#     padrao: "MsMpEng"
#     obrigatorio: true
#     opcoes: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function Out-Status($nivel, $msg) { Write-Output "FAROL_STATUS: $nivel $msg" }

$l = ("$env:FAROL_PROCESSOS" -replace '\s', '' -replace '\.exe', '').Split(',') | Where-Object { $_ -match '^[\w.-]+$' }
if (-not $l) { Write-Output "Informe PROCESSOS."; exit 2 }
$falta = $l | Where-Object { -not (Get-Process -Name $_ -ErrorAction SilentlyContinue) }
if ($falta) { Out-Status 'critico' ("Processo(s) ausente(s): " + ($falta -join ', ')) } else { Out-Status 'ok' ("Em execução: " + ($l -join ', ')) }
exit 0
