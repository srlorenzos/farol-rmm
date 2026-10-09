# ---
# id: teste-sistema-ping-dns-http-resumo
# nome: "Teste rápido de saúde do endpoint"
# descricao: "Executa uma bateria curta: gateway, DNS, internet, hora, espaço em C:, serviços-chave e reinício pendente, e imprime um resumo em linhas OK/FALHA."
# categoria: Utilitários
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 120
# requer_admin: false
# tags: [triagem, saude]
# variaveis: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

function Res($n, $ok, $d) { Write-Output ("[{0}] {1} {2}" -f $(if ($ok) { 'OK   ' } else { 'FALHA' }), $n, $d) }
$gw = (Get-NetRoute -DestinationPrefix '0.0.0.0/0' -ErrorAction SilentlyContinue | Select-Object -First 1).NextHop
Res 'Gateway responde' ($gw -and (Test-Connection $gw -Count 1 -Quiet)) $gw
Res 'DNS resolve' ([bool](Resolve-DnsName 'www.microsoft.com' -ErrorAction SilentlyContinue)) ''
Res 'Internet (1.1.1.1)' (Test-Connection 1.1.1.1 -Count 1 -Quiet) ''
$v = Get-Volume -DriveLetter C
Res 'Espaço livre em C: > 10%' (($v.SizeRemaining / $v.Size) -gt 0.1) ("{0:N0}% livre" -f ($v.SizeRemaining / $v.Size * 100))
foreach ($s in 'EventLog', 'Dnscache', 'W32Time', 'WinDefend', 'mpssvc') { $x = Get-Service $s -ErrorAction SilentlyContinue; Res "Serviço $s" ($x -and $x.Status -eq 'Running') $x.Status }
Res 'Sem reinício pendente' (-not (Test-Path 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\WindowsUpdate\Auto Update\RebootRequired')) ''
exit 0
