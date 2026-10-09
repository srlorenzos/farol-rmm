# ---
# id: remover-impressora
# nome: "Remover impressora"
# descricao: "Remove uma impressora (e opcionalmente sua porta TCP/IP) pelo nome."
# categoria: Impressoras
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 60
# requer_admin: true
# tags: [impressoras]
# variaveis:
#   - nome: NOME
#     rotulo: "Nome da impressora"
#     tipo: texto
#     padrao: ""
#     obrigatorio: true
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
$n = "$env:FAROL_NOME".Trim()
$p = Get-Printer -Name $n -ErrorAction SilentlyContinue
if (-not $p) { Write-Output "Impressora não encontrada; nada a fazer."; exit 0 }
if (-not (Test-Confirmar)) { Write-Output "Defina CONFIRMAR=true para remover '$n' (porta $($p.PortName))."; exit 0 }
Remove-Printer -Name $n
if ($p.PortName -like 'IP_*' -and -not (Get-Printer | Where-Object PortName -eq $p.PortName)) { Remove-PrinterPort -Name $p.PortName -ErrorAction SilentlyContinue }
Write-Output "Removida."
exit 0
