# ---
# id: testar-mtu-caminho
# nome: "Descobrir MTU do caminho"
# descricao: "Testa pacotes ICMP com bit DF para encontrar o maior MTU sem fragmentação até um destino."
# categoria: Rede
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 120
# requer_admin: false
# tags: [mtu, rede]
# variaveis:
#   - nome: HOST
#     rotulo: "Destino"
#     tipo: texto
#     padrao: "8.8.8.8"
#     obrigatorio: false
#     opcoes: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

$h = if ($env:FAROL_HOST -match '^[A-Za-z0-9._-]+$') { $env:FAROL_HOST } else { '8.8.8.8' }
$lo = 1200; $hi = 1472; $melhor = 0
while ($lo -le $hi) {
  $m = [int](($lo + $hi) / 2)
  $r = ping.exe -n 1 -f -l $m -w 1500 $h | Out-String
  if ($r -match 'TTL=') { $melhor = $m; $lo = $m + 1 } else { $hi = $m - 1 }
}
if ($melhor -eq 0) { Write-Output "Sem resposta de $h."; exit 1 }
Write-Output ("Maior payload sem fragmentar: {0} bytes; MTU do caminho = {1}" -f $melhor, ($melhor + 28))
exit 0
