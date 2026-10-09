# ---
# id: resolver-dns
# nome: "Diagnóstico de resolução DNS"
# descricao: "Resolve nomes (A, AAAA, MX, TXT) usando o DNS do sistema e, opcionalmente, um servidor específico para comparação."
# categoria: Rede
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 120
# requer_admin: false
# tags: [dns, diagnostico]
# variaveis:
#   - nome: NOME
#     rotulo: "Nome a resolver"
#     tipo: texto
#     padrao: "google.com"
#     obrigatorio: true
#     opcoes: []
#   - nome: SERVIDOR
#     rotulo: "Servidor DNS alternativo (opcional)"
#     tipo: texto
#     padrao: ""
#     obrigatorio: false
#     opcoes: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

$n = "$env:FAROL_NOME".Trim()
if ($n -notmatch '^[A-Za-z0-9._-]+$') { Write-Output "Nome inválido."; exit 1 }
$sv = "$env:FAROL_SERVIDOR".Trim()
foreach ($t in 'A','AAAA','MX','TXT') {
  Write-Output "== $t (DNS do sistema) =="
  try { Resolve-DnsName -Name $n -Type $t -ErrorAction Stop | Select-Object Name, Type, TTL, @{n='Dado';e={ if ($_.IPAddress) { $_.IPAddress } elseif ($_.NameExchange) { "$($_.Preference) $($_.NameExchange)" } else { $_.Strings -join ' ' } }} | Format-Table -AutoSize | Out-String | Write-Output } catch { Write-Output "sem resposta" }
}
if ($sv -match '^[0-9a-fA-F:.]+$') {
  Write-Output "== A via $sv =="
  try { Resolve-DnsName -Name $n -Type A -Server $sv -ErrorAction Stop | Select-Object Name, IPAddress | Format-Table | Out-String | Write-Output } catch { Write-Output "sem resposta de $sv" }
}
exit 0
