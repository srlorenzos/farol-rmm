# ---
# id: mon-firewall-ativo
# nome: "Monitor - Firewall do Windows"
# descricao: "Verifica se os três perfis do Firewall do Windows estão ativos."
# categoria: Monitoramento
# so: [windows]
# shell: powershell
# tipo: monitor
# tempo_limite: 60
# requer_admin: false
# tags: [firewall, monitor]
# variaveis: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function Out-Status($nivel, $msg) { Write-Output "FAROL_STATUS: $nivel $msg" }

$off = Get-NetFirewallProfile | Where-Object { -not $_.Enabled } | ForEach-Object { $_.Name }
if ($off) { Out-Status 'critico' ("Firewall desligado nos perfis: " + ($off -join ', ')) } else { Out-Status 'ok' 'Firewall ativo em todos os perfis' }
exit 0
