# ---
# id: inventario-eventos-instalacao-software-rede
# nome: "Programas que escutam na rede"
# descricao: "Cruza portas em escuta com o caminho do executável e assinatura, para identificar software desconhecido exposto."
# categoria: Inventário e auditoria
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 180
# requer_admin: false
# tags: [portas, software]
# variaveis: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object { $_.LocalAddress -notin '127.0.0.1', '::1' } | Group-Object OwningProcess | ForEach-Object {
  $p = Get-Process -Id $_.Name -ErrorAction SilentlyContinue
  if ($p -and $p.Path) { $s = Get-AuthenticodeSignature $p.Path -ErrorAction SilentlyContinue; [pscustomobject]@{ Processo = $p.ProcessName; Portas = (($_.Group.LocalPort | Sort-Object -Unique) -join ','); Assinatura = $s.Status; Caminho = $p.Path } }
} | Sort-Object Assinatura | Format-Table -AutoSize | Out-String -Width 220 | Write-Output
exit 0
