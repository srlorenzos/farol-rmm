# ---
# id: falhas-de-logon-recentes
# nome: "Falhas de logon recentes (evento 4625)"
# descricao: "Resume tentativas de logon com falha nas últimas horas, por conta e origem — útil para detectar força bruta."
# categoria: Segurança
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 120
# requer_admin: true
# tags: [logon, forca-bruta, eventos]
# variaveis:
#   - nome: HORAS
#     rotulo: "Janela de análise (horas)"
#     tipo: numero
#     padrao: 24
#     obrigatorio: false
#     opcoes: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function Get-Num($v, $padrao) { if ("$v" -match '^\d+$') { [int]$v } else { $padrao } }

$h = Get-Num $env:FAROL_HORAS 24
$ev = Get-WinEvent -FilterHashtable @{ LogName = 'Security'; Id = 4625; StartTime = (Get-Date).AddHours(-$h) } -ErrorAction SilentlyContinue
if (-not $ev) { Write-Output "Nenhuma falha de logon nas últimas $h h (ou sem permissão para ler o log Security)."; exit 0 }
$ev | ForEach-Object { $x = [xml]$_.ToXml(); $dt = @{}; $x.Event.EventData.Data | ForEach-Object { $dt[$_.Name] = $_.'#text' }
  [pscustomobject]@{ Conta = $dt['TargetUserName']; Origem = $dt['IpAddress']; Tipo = $dt['LogonType'] } } |
  Group-Object Conta, Origem | Sort-Object Count -Descending | Select-Object -First 25 Count, Name | Format-Table -AutoSize | Out-String | Write-Output
Write-Output "Total de falhas: $(@($ev).Count)"
exit 0
