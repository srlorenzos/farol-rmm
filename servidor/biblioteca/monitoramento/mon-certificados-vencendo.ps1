# ---
# id: mon-certificados-vencendo
# nome: "Monitor - certificados do computador vencendo"
# descricao: "Verifica certificados no repositório LocalMachine\\My (e opcionalmente Root) que vencem em breve ou já venceram."
# categoria: Monitoramento
# so: [windows]
# shell: powershell
# tipo: monitor
# tempo_limite: 60
# requer_admin: false
# tags: [certificados, monitor]
# variaveis:
#   - nome: ALERTA
#     rotulo: "Alerta (dias para vencer)"
#     tipo: numero
#     padrao: 30
#     obrigatorio: false
#     opcoes: []
#   - nome: CRITICO
#     rotulo: "Crítico (dias para vencer)"
#     tipo: numero
#     padrao: 7
#     obrigatorio: false
#     opcoes: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function Get-Num($v, $padrao) { if ("$v" -match '^\d+$') { [int]$v } else { $padrao } }
function Out-Status($nivel, $msg) { Write-Output "FAROL_STATUS: $nivel $msg" }

$a = Get-Num $env:FAROL_ALERTA 30; $c = Get-Num $env:FAROL_CRITICO 7
$certs = Get-ChildItem Cert:\LocalMachine\My -ErrorAction SilentlyContinue | Where-Object { $_.HasPrivateKey }
$venc = @($certs | Where-Object { $_.NotAfter -lt (Get-Date) })
$crit = @($certs | Where-Object { $_.NotAfter -ge (Get-Date) -and $_.NotAfter -lt (Get-Date).AddDays($c) })
$alt = @($certs | Where-Object { $_.NotAfter -ge (Get-Date).AddDays($c) -and $_.NotAfter -lt (Get-Date).AddDays($a) })
function N($l) { ($l | Select-Object -First 3 | ForEach-Object { "$($_.Subject.Split(',')[0]) ($($_.NotAfter.ToString('yyyy-MM-dd')))" }) -join '; ' }
if ($venc.Count + $crit.Count -gt 0) { Out-Status 'critico' ("Vencidos/vencendo em ${c}d: " + (N ($venc + $crit))) }
elseif ($alt.Count) { Out-Status 'alerta' ("Vencendo em ${a}d: " + (N $alt)) }
else { Out-Status 'ok' "$(@($certs).Count) certificado(s) válido(s)" }
exit 0
