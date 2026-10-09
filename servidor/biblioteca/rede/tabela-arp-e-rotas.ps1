# ---
# id: tabela-arp-e-rotas
# nome: "Tabela ARP e rotas"
# descricao: "Exibe vizinhos ARP e a tabela de rotas IPv4 para diagnóstico de roteamento."
# categoria: Rede
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 120
# requer_admin: false
# tags: [arp, rotas]
# variaveis: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

Write-Output "== Vizinhos (ARP) =="
Get-NetNeighbor -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { $_.State -ne 'Unreachable' -and $_.IPAddress -notmatch '^(224|239|255)\.' } | Select-Object IPAddress, LinkLayerAddress, State, InterfaceAlias | Format-Table -AutoSize | Out-String | Write-Output
Write-Output "== Rotas IPv4 =="
Get-NetRoute -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { $_.DestinationPrefix -notmatch '^(224|255)\.' } | Sort-Object RouteMetric | Select-Object DestinationPrefix, NextHop, RouteMetric, InterfaceAlias | Format-Table -AutoSize | Out-String | Write-Output
exit 0
