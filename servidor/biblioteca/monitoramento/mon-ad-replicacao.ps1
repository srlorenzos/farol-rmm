# ---
# id: mon-ad-replicacao
# nome: "Monitor - replicação do Active Directory"
# descricao: "Executa repadmin /replsummary e alerta se houver falhas de replicação entre controladores de domínio."
# categoria: Monitoramento
# so: [windows]
# shell: powershell
# tipo: monitor
# tempo_limite: 120
# requer_admin: true
# tags: [ad, replicacao, monitor]
# variaveis: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function Out-Status($nivel, $msg) { Write-Output "FAROL_STATUS: $nivel $msg" }

if (-not (Get-Command repadmin.exe -ErrorAction SilentlyContinue)) { Out-Status 'ok' 'repadmin ausente (não é um DC)'; exit 0 }
$o = repadmin /replsummary 2>&1 | Out-String
$f = [regex]::Matches($o, '(?m)^\s*\S+\s+\S+\s+\S+\s+(\d+)\s*/\s*\d+\s+(\d+)') | ForEach-Object { [int]$_.Groups[2].Value } | Measure-Object -Sum
if ($f.Sum -gt 0) { Out-Status 'critico' "$($f.Sum) falha(s) de replicação" } elseif ($o -match 'error|erro') { Out-Status 'alerta' 'Mensagens de erro no replsummary' } else { Out-Status 'ok' 'Replicação sem falhas' }
exit 0
