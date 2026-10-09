# ---
# id: logons-remotos-recentes
# nome: "Logons remotos (RDP/rede) bem-sucedidos"
# descricao: "Lista logons bem-sucedidos dos tipos 3 e 10 (rede e RDP) nas últimas horas, com usuário e IP de origem."
# categoria: Segurança
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 120
# requer_admin: true
# tags: [rdp, logon, eventos]
# variaveis:
#   - nome: HORAS
#     rotulo: "Janela (horas)"
#     tipo: numero
#     padrao: 72
#     obrigatorio: false
#     opcoes: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function Get-Num($v, $padrao) { if ("$v" -match '^\d+$') { [int]$v } else { $padrao } }

$h = Get-Num $env:FAROL_HORAS 72
$ev = Get-WinEvent -FilterHashtable @{ LogName = 'Security'; Id = 4624; StartTime = (Get-Date).AddHours(-$h) } -ErrorAction SilentlyContinue
$r = foreach ($e in $ev) { $x = [xml]$e.ToXml(); $dt = @{}; $x.Event.EventData.Data | ForEach-Object { $dt[$_.Name] = $_.'#text' }
  if ($dt['LogonType'] -in '3', '10' -and $dt['TargetUserName'] -notmatch '\$$|ANONYMOUS|^-$' -and $dt['IpAddress'] -notin '-', '::1', '127.0.0.1', $null) {
    [pscustomobject]@{ Hora = $e.TimeCreated.ToString('yyyy-MM-dd HH:mm'); Usuario = $dt['TargetUserName']; Tipo = $dt['LogonType']; Origem = $dt['IpAddress'] } } }
if (-not $r) { Write-Output "Nenhum logon remoto encontrado."; exit 0 }
$r | Select-Object -First 100 | Format-Table -AutoSize | Out-String | Write-Output
exit 0
