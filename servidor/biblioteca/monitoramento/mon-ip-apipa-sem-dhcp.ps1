# ---
# id: mon-ip-apipa-sem-dhcp
# nome: "Monitor - IP APIPA (169.254) ou sem gateway"
# descricao: "Detecta falta de concessão DHCP (APIPA) ou ausência de gateway padrão."
# categoria: Monitoramento
# so: [windows]
# shell: powershell
# tipo: monitor
# tempo_limite: 60
# requer_admin: false
# tags: [rede, dhcp, monitor]
# variaveis: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function Out-Status($nivel, $msg) { Write-Output "FAROL_STATUS: $nivel $msg" }

$up = @(Get-NetAdapter -ErrorAction SilentlyContinue | Where-Object { $_.Status -eq 'Up' } | ForEach-Object { $_.ifIndex })
$apipa = @(Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { $_.IPAddress -like '169.254.*' -and $_.InterfaceIndex -in $up })
$gw = @(Get-NetRoute -DestinationPrefix '0.0.0.0/0' -ErrorAction SilentlyContinue)
if ($apipa.Count) { Out-Status 'critico' "IP APIPA em uso: $($apipa[0].IPAddress) (DHCP falhou)" }
elseif (-not $gw.Count) { Out-Status 'alerta' 'Sem gateway padrão' }
else { Out-Status 'ok' "Gateway $($gw[0].NextHop)" }
exit 0
