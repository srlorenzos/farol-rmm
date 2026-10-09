# ---
# id: instalar-rsat
# nome: "Instalar ferramentas RSAT"
# descricao: "Instala os recursos RSAT (Active Directory, DNS, DHCP, GPO) como Recursos sob Demanda em Windows 10/11."
# categoria: Software
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 1800
# requer_admin: true
# tags: [rsat, ad]
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
$caps = Get-WindowsCapability -Online -Name 'Rsat.*' | Where-Object { $_.Name -match 'ActiveDirectory|GroupPolicy|Dns|DHCP' }
$caps | Select-Object Name, State | Format-Table -AutoSize | Out-String | Write-Output
if (-not (Test-Confirmar)) { Write-Output "Defina CONFIRMAR=true para instalar os pendentes."; exit 0 }
$caps | Where-Object State -ne 'Installed' | ForEach-Object { Write-Output "Instalando $($_.Name)"; Add-WindowsCapability -Online -Name $_.Name | Out-Null }
exit 0
