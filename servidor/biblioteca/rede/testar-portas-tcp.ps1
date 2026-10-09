# ---
# id: testar-portas-tcp
# nome: "Testar portas TCP de um host"
# descricao: "Verifica se portas TCP estão acessíveis em um host (útil para validar firewall, RDP, SQL, HTTPS etc.)."
# categoria: Rede
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 120
# requer_admin: false
# tags: [rede, portas, tcp]
# variaveis:
#   - nome: HOST
#     rotulo: "Host ou IP"
#     tipo: texto
#     padrao: ""
#     obrigatorio: true
#     opcoes: []
#   - nome: PORTAS
#     rotulo: "Portas separadas por vírgula"
#     tipo: texto
#     padrao: "80,443,3389"
#     obrigatorio: false
#     opcoes: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

$h = "$env:FAROL_HOST".Trim()
if ($h -notmatch '^[A-Za-z0-9._:-]+$') { Write-Output "Host inválido."; exit 1 }
$portas = if ($env:FAROL_PORTAS) { $env:FAROL_PORTAS } else { '80,443,3389' }
foreach ($p in ($portas -replace '\s', '').Split(',')) {
  if ($p -notmatch '^\d{1,5}$') { continue }
  $c = New-Object System.Net.Sockets.TcpClient
  $a = $c.BeginConnect($h, [int]$p, $null, $null)
  $ok = $a.AsyncWaitHandle.WaitOne(3000) -and $c.Connected
  Write-Output ("{0}:{1} -> {2}" -f $h, $p, $(if ($ok) { 'ABERTA' } else { 'fechada/filtrada' }))
  $c.Close()
}
exit 0
