# ---
# id: listar-regras-firewall-farol
# nome: "Regras de firewall criadas pelo Farol"
# descricao: "Lista as regras criadas por scripts do Farol (prefixo \"FAROL - \") para controle e limpeza."
# categoria: Firewall
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 120
# requer_admin: false
# tags: [firewall]
# variaveis: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

$r = Get-NetFirewallRule -DisplayName 'FAROL - *' -ErrorAction SilentlyContinue
if (-not $r) { Write-Output "Nenhuma regra FAROL encontrada."; exit 0 }
$r | Select-Object DisplayName, Direction, Action, Enabled | Format-Table -AutoSize | Out-String -Width 200 | Write-Output
exit 0
