# ---
# id: definir-ip-estatico
# nome: "Definir IP estático"
# descricao: "Configura IP, máscara (prefixo), gateway e DNS em um adaptador. Valida todos os valores e exige confirmação para evitar perda de acesso."
# categoria: Rede
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 60
# requer_admin: true
# tags: [ip, configuracao]
# variaveis:
#   - nome: ADAPTADOR
#     rotulo: "Nome do adaptador"
#     tipo: texto
#     padrao: "Ethernet"
#     obrigatorio: true
#     opcoes: []
#   - nome: IP
#     rotulo: "Endereço IPv4"
#     tipo: texto
#     padrao: ""
#     obrigatorio: true
#     opcoes: []
#   - nome: PREFIXO
#     rotulo: "Prefixo (ex.: 24)"
#     tipo: numero
#     padrao: 24
#     obrigatorio: true
#     opcoes: []
#   - nome: GATEWAY
#     rotulo: "Gateway"
#     tipo: texto
#     padrao: ""
#     obrigatorio: true
#     opcoes: []
#   - nome: DNS
#     rotulo: "DNS separados por vírgula"
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
function Get-Num($v, $padrao) { if ("$v" -match '^\d+$') { [int]$v } else { $padrao } }
function Test-Admin { ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator) }
function Exigir-Admin { if (-not (Test-Admin)) { Write-Output 'ERRO: este script precisa ser executado como administrador.'; exit 1 } }
function Test-Confirmar { "$env:FAROL_CONFIRMAR" -match '^(1|true|sim|s|yes|y|verdadeiro)$' }

Exigir-Admin
$o = $null
foreach ($v in $env:FAROL_IP, $env:FAROL_GATEWAY) { if (-not [System.Net.IPAddress]::TryParse("$v", [ref]$o)) { Write-Output "Endereço inválido: $v"; exit 1 } }
$pf = Get-Num $env:FAROL_PREFIXO 24
if ($pf -lt 8 -or $pf -gt 30) { Write-Output "Prefixo inválido."; exit 1 }
$a = Get-NetAdapter -Name $env:FAROL_ADAPTADOR -ErrorAction SilentlyContinue
if (-not $a) { Write-Output "Adaptador não encontrado: $env:FAROL_ADAPTADOR"; exit 1 }
Write-Output "Aplicará: $env:FAROL_IP/$pf gw $env:FAROL_GATEWAY em $($a.Name)"
if (-not (Test-Confirmar)) { Write-Output "Defina CONFIRMAR=true para aplicar (risco de perder acesso remoto se o IP estiver errado)."; exit 0 }
Get-NetIPAddress -InterfaceIndex $a.ifIndex -AddressFamily IPv4 -ErrorAction SilentlyContinue | Remove-NetIPAddress -Confirm:$false -ErrorAction SilentlyContinue
Remove-NetRoute -InterfaceIndex $a.ifIndex -DestinationPrefix '0.0.0.0/0' -Confirm:$false -ErrorAction SilentlyContinue
New-NetIPAddress -InterfaceIndex $a.ifIndex -IPAddress $env:FAROL_IP -PrefixLength $pf -DefaultGateway $env:FAROL_GATEWAY | Out-Null
if ($env:FAROL_DNS) { Set-DnsClientServerAddress -InterfaceIndex $a.ifIndex -ServerAddresses (("$env:FAROL_DNS" -replace '\s', '').Split(',')) }
Write-Output "IP estático aplicado."
exit 0
