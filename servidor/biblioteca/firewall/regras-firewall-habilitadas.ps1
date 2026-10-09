# ---
# id: regras-firewall-habilitadas
# nome: "Listar regras de entrada permitidas no firewall"
# descricao: "Lista regras de entrada habilitadas que permitem tráfego, com programa, portas e perfis, para revisão de exposição."
# categoria: Firewall
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 120
# requer_admin: false
# tags: [firewall, regras]
# variaveis:
#   - nome: SAIDA
#     rotulo: "Formato de saída"
#     tipo: selecao
#     padrao: "texto"
#     obrigatorio: false
#     opcoes: [texto, json]
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function Out-Dados($d) { if ("$env:FAROL_SAIDA" -eq 'json') { $d | ConvertTo-Json -Depth 4 } else { ($d | Format-Table -AutoSize | Out-String -Width 220).TrimEnd() } }

$d = Get-NetFirewallRule -Direction Inbound -Enabled True -Action Allow -ErrorAction SilentlyContinue | ForEach-Object {
  $pf = $_ | Get-NetFirewallPortFilter; $ap = $_ | Get-NetFirewallApplicationFilter
  [pscustomobject]@{ Regra = $_.DisplayName; Perfil = $_.Profile; Protocolo = $pf.Protocol; PortaLocal = $pf.LocalPort; Programa = $ap.Program }
} | Where-Object { $_.PortaLocal -ne 'Any' -or $_.Programa -ne 'Any' } | Sort-Object Regra
Out-Dados ($d | Select-Object -First 150)
exit 0
