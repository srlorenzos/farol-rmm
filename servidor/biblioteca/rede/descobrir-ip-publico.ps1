# ---
# id: descobrir-ip-publico
# nome: "Descobrir IP público"
# descricao: "Consulta serviços externos para identificar o IP público e o provedor (ASN) da conexão."
# categoria: Rede
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 60
# requer_admin: false
# tags: [ip-publico]
# variaveis: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
try {
  $r = Invoke-RestMethod -Uri 'https://ipinfo.io/json' -TimeoutSec 15
  Write-Output ("IP público: {0}`nProvedor: {1}`nLocal: {2}, {3}/{4}" -f $r.ip, $r.org, $r.city, $r.region, $r.country)
} catch {
  try { Write-Output ("IP público: " + (Invoke-RestMethod 'https://api.ipify.org' -TimeoutSec 15)) } catch { Write-Output "Sem acesso à internet."; exit 1 }
}
exit 0
