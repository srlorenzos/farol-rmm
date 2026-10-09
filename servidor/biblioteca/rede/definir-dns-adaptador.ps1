# ---
# id: definir-dns-adaptador
# nome: "Definir servidores DNS do adaptador"
# descricao: "Define os servidores DNS (IPv4) dos adaptadores ativos ou de um adaptador específico. Valida os endereços informados."
# categoria: Rede
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 60
# requer_admin: true
# tags: [dns, configuracao]
# variaveis:
#   - nome: SERVIDORES
#     rotulo: "Servidores DNS separados por vírgula"
#     tipo: texto
#     padrao: "1.1.1.1,8.8.8.8"
#     obrigatorio: true
#     opcoes: []
#   - nome: ADAPTADOR
#     rotulo: "Nome do adaptador (vazio = todos ativos)"
#     tipo: texto
#     padrao: ""
#     obrigatorio: false
#     opcoes: []
#   - nome: CONFIRMAR
#     rotulo: "Digite true para confirmar a execução"
#     tipo: booleano
#     padrao: false
#     obrigatorio: false
#     opcoes: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function Test-Admin { ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator) }
function Exigir-Admin { if (-not (Test-Admin)) { Write-Output 'ERRO: este script precisa ser executado como administrador.'; exit 1 } }
function Test-Confirmar { "$env:FAROL_CONFIRMAR" -match '^(1|true|sim|s|yes|y|verdadeiro)$' }

Exigir-Admin
$ips = ("$env:FAROL_SERVIDORES" -replace '\s', '').Split(',') | Where-Object { $_ }
foreach ($i in $ips) { $o = $null; if (-not [System.Net.IPAddress]::TryParse($i, [ref]$o)) { Write-Output "IP inválido: $i"; exit 1 } }
$ad = Get-NetAdapter -Physical | Where-Object { $_.Status -eq 'Up' }
if ($env:FAROL_ADAPTADOR) { $ad = $ad | Where-Object { $_.Name -eq $env:FAROL_ADAPTADOR } }
if (-not $ad) { Write-Output "Nenhum adaptador encontrado."; exit 1 }
foreach ($a in $ad) {
  Write-Output ("{0}: DNS atual {1}" -f $a.Name, ((Get-DnsClientServerAddress -InterfaceIndex $a.ifIndex -AddressFamily IPv4).ServerAddresses -join ','))
  if (Test-Confirmar) { Set-DnsClientServerAddress -InterfaceIndex $a.ifIndex -ServerAddresses $ips; Write-Output "  -> alterado para $($ips -join ',')" }
}
if (-not (Test-Confirmar)) { Write-Output "Nada alterado. Defina CONFIRMAR=true para aplicar." }
exit 0
