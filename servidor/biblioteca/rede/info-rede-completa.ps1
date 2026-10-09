# ---
# id: info-rede-completa
# nome: "Informações completas de rede"
# descricao: "Lista adaptadores ativos com IP, máscara, gateway, DNS, MAC, velocidade, DHCP e perfil de rede."
# categoria: Rede
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 120
# requer_admin: false
# tags: [rede, ip, inventario]
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

$d = Get-NetAdapter -Physical -ErrorAction SilentlyContinue | Where-Object { $_.Status -eq 'Up' } | ForEach-Object {
  $cfg = Get-NetIPConfiguration -InterfaceIndex $_.ifIndex -ErrorAction SilentlyContinue
  $ip4 = Get-NetIPAddress -InterfaceIndex $_.ifIndex -AddressFamily IPv4 -ErrorAction SilentlyContinue | Select-Object -First 1
  [pscustomobject]@{
    Adaptador = $_.Name; MAC = $_.MacAddress; Velocidade = $_.LinkSpeed
    IPv4 = $ip4.IPAddress; Prefixo = $ip4.PrefixLength
    Gateway = ($cfg.IPv4DefaultGateway.NextHop -join ','); DNS = ($cfg.DNSServer.ServerAddresses -join ',')
    DHCP = (Get-NetIPInterface -InterfaceIndex $_.ifIndex -AddressFamily IPv4 -ErrorAction SilentlyContinue).Dhcp
  }
}
if (-not $d) { Write-Output "Nenhum adaptador físico ativo."; exit 0 }
Out-Dados $d
exit 0
