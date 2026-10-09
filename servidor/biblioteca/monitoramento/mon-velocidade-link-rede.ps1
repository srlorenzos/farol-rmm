# ---
# id: mon-velocidade-link-rede
# nome: "Monitor - velocidade do link de rede"
# descricao: "Alerta se o adaptador ativo negociou velocidade inferior ao mínimo esperado (cabo ruim, porta com defeito)."
# categoria: Monitoramento
# so: [windows]
# shell: powershell
# tipo: monitor
# tempo_limite: 60
# requer_admin: false
# tags: [rede, link, monitor]
# variaveis:
#   - nome: MIN_MBPS
#     rotulo: "Mínimo esperado (Mbps)"
#     tipo: numero
#     padrao: 1000
#     obrigatorio: false
#     opcoes: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function Get-Num($v, $padrao) { if ("$v" -match '^\d+$') { [int]$v } else { $padrao } }
function Out-Status($nivel, $msg) { Write-Output "FAROL_STATUS: $nivel $msg" }

$min = Get-Num $env:FAROL_MIN_MBPS 1000
$a = @(Get-NetAdapter -Physical | Where-Object { $_.Status -eq 'Up' -and $_.MediaType -match '802.3' })
if (-not $a) { Out-Status 'ok' 'Sem adaptador Ethernet ativo (Wi-Fi ou desconectado)'; exit 0 }
$menor = ($a | Measure-Object Speed -Minimum).Minimum / 1e6
if ($menor -lt $min) { Out-Status 'alerta' "Link Ethernet a $menor Mbps (esperado >= $min)" } else { Out-Status 'ok' "Link Ethernet a $menor Mbps" }
exit 0
