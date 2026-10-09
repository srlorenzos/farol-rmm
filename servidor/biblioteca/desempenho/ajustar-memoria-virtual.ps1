# ---
# id: ajustar-memoria-virtual
# nome: "Configurar arquivo de paginação"
# descricao: "Mostra e opcionalmente define o pagefile gerenciado pelo sistema ou com tamanho fixo (MB). Requer reinício."
# categoria: Desempenho
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 120
# requer_admin: true
# tags: [pagefile, memoria]
# variaveis:
#   - nome: MODO
#     rotulo: "Modo"
#     tipo: selecao
#     padrao: "consultar"
#     obrigatorio: true
#     opcoes: [consultar, automatico, fixo]
#   - nome: TAMANHO_MB
#     rotulo: "Tamanho fixo (MB)"
#     tipo: numero
#     padrao: 8192
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
Get-CimInstance Win32_PageFileSetting | Select-Object Name, InitialSize, MaximumSize | Format-Table | Out-String | Write-Output
Get-CimInstance Win32_ComputerSystem | ForEach-Object { Write-Output "Gerenciado automaticamente: $($_.AutomaticManagedPagefile)" }
$modo = "$env:FAROL_MODO"
if ($modo -eq 'consultar' -or -not $modo) { exit 0 }
if (-not (Test-Confirmar)) { Write-Output "Defina CONFIRMAR=true para aplicar '$modo'."; exit 0 }
$cs = Get-CimInstance Win32_ComputerSystem
if ($modo -eq 'automatico') { Set-CimInstance -InputObject $cs -Property @{ AutomaticManagedPagefile = $true } }
else {
  $mb = Get-Num $env:FAROL_TAMANHO_MB 8192
  Set-CimInstance -InputObject $cs -Property @{ AutomaticManagedPagefile = $false }
  $pf = Get-CimInstance Win32_PageFileSetting | Select-Object -First 1
  if ($pf) { Set-CimInstance -InputObject $pf -Property @{ InitialSize = $mb; MaximumSize = $mb } } else { New-CimInstance -ClassName Win32_PageFileSetting -Property @{ Name = 'C:\pagefile.sys'; InitialSize = [uint32]$mb; MaximumSize = [uint32]$mb } | Out-Null }
}
Write-Output "Configuração aplicada. Reinicie para efetivar."
exit 0
