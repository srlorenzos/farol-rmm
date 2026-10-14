# ---
# id: adicionar-impressora-ip
# nome: "Adicionar impressora de rede por IP"
# descricao: "Cria porta TCP/IP padrão e instala a impressora usando um driver já presente no sistema. Idempotente."
# categoria: Impressoras
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 120
# requer_admin: true
# tags: [impressoras, instalacao]
# variaveis:
#   - nome: NOME
#     rotulo: "Nome da impressora"
#     tipo: texto
#     padrao: ""
#     obrigatorio: true
#     opcoes: []
#   - nome: IP
#     rotulo: "Endereço IP ou host"
#     tipo: texto
#     padrao: ""
#     obrigatorio: true
#     opcoes: []
#   - nome: DRIVER
#     rotulo: "Nome exato do driver instalado"
#     tipo: texto
#     padrao: ""
#     obrigatorio: true
#     opcoes: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function Test-Admin { ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator) }
function Exigir-Admin { if (-not (Test-Admin)) { Write-Output 'ERRO: este script precisa ser executado como administrador.'; exit 1 } }

Exigir-Admin
$n = "$env:FAROL_NOME".Trim(); $ip = "$env:FAROL_IP".Trim(); $dr = "$env:FAROL_DRIVER".Trim()
if ($n -notmatch '^[\w .-]{1,60}$' -or $ip -notmatch '^[A-Za-z0-9._-]+$') { Write-Output "Nome ou IP inválido."; exit 1 }
if (-not (Get-PrinterDriver -Name $dr -ErrorAction SilentlyContinue)) { Write-Output "Driver '$dr' não instalado. Drivers disponíveis:"; Get-PrinterDriver | ForEach-Object { " - $($_.Name)" }; exit 1 }
if (Get-Printer -Name $n -ErrorAction SilentlyContinue) { Write-Output "Impressora '$n' já existe."; exit 0 }
$porta = "IP_$ip"
if (-not (Get-PrinterPort -Name $porta -ErrorAction SilentlyContinue)) { Add-PrinterPort -Name $porta -PrinterHostAddress $ip }
Add-Printer -Name $n -DriverName $dr -PortName $porta
Write-Output "Impressora '$n' instalada na porta $porta."
exit 0
