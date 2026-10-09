# ---
# id: inventario-usuarios-logados-historico
# nome: "Histórico de usuários que fizeram logon"
# descricao: "Lista quem fez logon interativo/RDP no computador nos últimos dias (evento 4624 tipos 2, 10, 11)."
# categoria: Inventário e auditoria
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 120
# requer_admin: true
# tags: [logon, historico]
# variaveis:
#   - nome: DIAS
#     rotulo: "Janela (dias)"
#     tipo: numero
#     padrao: 14
#     obrigatorio: false
#     opcoes: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function Get-Num($v, $padrao) { if ("$v" -match '^\d+$') { [int]$v } else { $padrao } }

$ini = (Get-Date).AddDays(-(Get-Num $env:FAROL_DIAS 14))
$ev = Get-WinEvent -FilterHashtable @{ LogName = 'Security'; Id = 4624; StartTime = $ini } -ErrorAction SilentlyContinue
$r = foreach ($e in $ev) { $x = [xml]$e.ToXml(); $d = @{}; $x.Event.EventData.Data | ForEach-Object { $d[$_.Name] = $_.'#text' }
  if ($d['LogonType'] -in '2', '10', '11' -and $d['TargetUserName'] -notmatch '^(DWM|UMFD|SYSTEM|LOCAL)') { [pscustomobject]@{ Usuario = "$($d['TargetDomainName'])\$($d['TargetUserName'])"; Tipo = $d['LogonType']; Dia = $e.TimeCreated.ToString('yyyy-MM-dd') } } }
if (-not $r) { Write-Output "Sem logons no período (ou sem acesso ao log Security)."; exit 0 }
$r | Group-Object Usuario | Sort-Object Count -Descending | Select-Object Count, Name | Format-Table -AutoSize | Out-String | Write-Output
exit 0
