# ---
# id: limpar-cache-dns-e-arp-local
# nome: "Limpar caches de resolução (DNS, ARP, NetBIOS)"
# descricao: "Limpa os caches DNS, ARP e NetBIOS do cliente sem alterar o IP. Seguro para uso em produção."
# categoria: Desempenho
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 60
# requer_admin: true
# tags: [cache, dns]
# variaveis: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function Test-Admin { ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator) }
function Exigir-Admin { if (-not (Test-Admin)) { Write-Output 'ERRO: este script precisa ser executado como administrador.'; exit 1 } }

Exigir-Admin
Clear-DnsClientCache
netsh interface ip delete arpcache | Out-Null
nbtstat -R | Out-Null
nbtstat -RR | Out-Null
Write-Output "Caches DNS, ARP e NetBIOS limpos."
exit 0
