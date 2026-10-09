# ---
# id: varredura-ping-subrede
# nome: "Varredura de hosts ativos na sub-rede"
# descricao: "Faz ping em todos os endereços da sub-rede local (até /24 por padrão) e lista os que respondem, com nome DNS quando disponível."
# categoria: Rede
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 600
# requer_admin: false
# tags: [descoberta, rede, inventario]
# variaveis:
#   - nome: PREFIXO
#     rotulo: "Prefixo de rede (ex.: 192.168.1) - vazio usa a rede atual"
#     tipo: texto
#     padrao: ""
#     obrigatorio: false
#     opcoes: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

$pre = "$env:FAROL_PREFIXO".Trim().TrimEnd('.')
if (-not $pre) {
  $ip = (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { $_.IPAddress -notmatch '^(127|169\.254)' -and $_.PrefixLength -ge 16 } | Select-Object -First 1).IPAddress
  if (-not $ip) { Write-Output "Sem IPv4 válido."; exit 1 }
  $pre = ($ip -split '\.')[0..2] -join '.'
}
if ($pre -notmatch '^\d{1,3}\.\d{1,3}\.\d{1,3}$') { Write-Output "Prefixo inválido."; exit 1 }
Write-Output "Varrendo $pre.1-254 ..."
$jobs = 1..254 | ForEach-Object { $a = "$pre.$_"; $p = New-Object System.Net.NetworkInformation.Ping; [pscustomobject]@{ A = $a; T = $p.SendPingAsync($a, 800) } }
$vivos = foreach ($j in $jobs) { try { if ($j.T.Result.Status -eq 'Success') { $j.A } } catch {} }
foreach ($v in $vivos) {
  $n = try { [System.Net.Dns]::GetHostEntry($v).HostName } catch { '-' }
  Write-Output ("{0,-16} {1}" -f $v, $n)
}
Write-Output ("Total de hosts ativos: {0}" -f @($vivos).Count)
exit 0
