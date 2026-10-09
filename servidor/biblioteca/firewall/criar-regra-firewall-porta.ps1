# ---
# id: criar-regra-firewall-porta
# nome: "Criar regra de firewall por porta"
# descricao: "Cria uma regra de entrada/saída (permitir ou bloquear) para uma porta TCP/UDP, com escopo opcional de IPs remotos. Idempotente pelo nome."
# categoria: Firewall
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 60
# requer_admin: true
# tags: [firewall, regra]
# variaveis:
#   - nome: NOME
#     rotulo: "Nome da regra"
#     tipo: texto
#     padrao: ""
#     obrigatorio: true
#     opcoes: []
#   - nome: PORTA
#     rotulo: "Porta ou intervalo"
#     tipo: texto
#     padrao: ""
#     obrigatorio: true
#     opcoes: []
#   - nome: PROTOCOLO
#     rotulo: "Protocolo"
#     tipo: selecao
#     padrao: "TCP"
#     obrigatorio: true
#     opcoes: [TCP, UDP]
#   - nome: DIRECAO
#     rotulo: "Direção"
#     tipo: selecao
#     padrao: "Entrada"
#     obrigatorio: true
#     opcoes: [Entrada, Saida]
#   - nome: ACAO
#     rotulo: "Ação"
#     tipo: selecao
#     padrao: "Permitir"
#     obrigatorio: true
#     opcoes: [Permitir, Bloquear]
#   - nome: REMOTOS
#     rotulo: "IPs/sub-redes remotos permitidos (opcional)"
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
$n = "FAROL - $("$env:FAROL_NOME".Trim())"; $p = "$env:FAROL_PORTA".Trim()
if ($n -notmatch '^[\w .-]+$' -or $p -notmatch '^\d{1,5}(-\d{1,5})?$') { Write-Output "Nome/porta inválidos."; exit 1 }
$rem = "$env:FAROL_REMOTOS".Trim()
if ($rem -and $rem -notmatch '^[0-9a-fA-F:./, -]+$') { Write-Output "Escopo remoto inválido."; exit 1 }
if (Get-NetFirewallRule -DisplayName $n -ErrorAction SilentlyContinue) { Write-Output "Regra '$n' já existe."; exit 0 }
if (-not (Test-Confirmar)) { Write-Output "Criaria '$n' ($env:FAROL_ACAO $env:FAROL_DIRECAO $env:FAROL_PROTOCOLO/$p). CONFIRMAR=true para aplicar."; exit 0 }
$a = @{ DisplayName = $n; Direction = $(if ("$env:FAROL_DIRECAO" -eq 'Saida') { 'Outbound' } else { 'Inbound' }); Action = $(if ("$env:FAROL_ACAO" -eq 'Bloquear') { 'Block' } else { 'Allow' }); Protocol = $env:FAROL_PROTOCOLO; LocalPort = $p }
if ($rem) { $a.RemoteAddress = $rem.Split(',') | ForEach-Object { $_.Trim() } }
New-NetFirewallRule @a | Out-Null
Write-Output "Regra '$n' criada."
exit 0
