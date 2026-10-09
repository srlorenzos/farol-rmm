# ---
# id: m365-testar-conectividade
# nome: "Microsoft 365 - testar conectividade de endpoints"
# descricao: "Testa DNS e HTTPS para os principais endpoints do Microsoft 365 (login, Outlook, Teams, SharePoint) e mostra latência."
# categoria: Microsoft 365
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 120
# requer_admin: false
# tags: [m365, conectividade]
# variaveis: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

$h = 'login.microsoftonline.com', 'outlook.office365.com', 'graph.microsoft.com', 'teams.microsoft.com', 'officecdn.microsoft.com', 'autodiscover-s.outlook.com'
foreach ($x in $h) {
  $sw = [Diagnostics.Stopwatch]::StartNew()
  $ok = Test-NetConnection -ComputerName $x -Port 443 -WarningAction SilentlyContinue
  Write-Output ("{0,-34} 443:{1,-5} {2} ms" -f $x, $(if ($ok.TcpTestSucceeded) { 'OK' } else { 'FALHA' }), $sw.ElapsedMilliseconds)
}
exit 0
