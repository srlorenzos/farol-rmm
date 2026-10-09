# ---
# id: renovar-ip-limpar-dns
# nome: "Renovar IP e limpar cache DNS"
# descricao: "Limpa o cache DNS e a tabela ARP e renova a concessão DHCP. Pode interromper a conexão por alguns segundos."
# categoria: Rede
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 120
# requer_admin: true
# tags: [dhcp, dns, rede]
# variaveis:
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
if (-not (Test-Confirmar)) { Write-Output "Defina CONFIRMAR=true para renovar o IP (conexão pode cair brevemente)."; exit 0 }
ipconfig /flushdns
netsh interface ip delete arpcache | Out-Null
ipconfig /release | Out-Null
ipconfig /renew
exit 0
