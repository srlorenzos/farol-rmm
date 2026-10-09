# ---
# id: ativar-firewall-todos-perfis
# nome: "Ativar o Firewall do Windows em todos os perfis"
# descricao: "Liga o firewall nos perfis Domínio, Privado e Público, com entrada bloqueada por padrão."
# categoria: Firewall
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 60
# requer_admin: true
# tags: [firewall, hardening]
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
Get-NetFirewallProfile | ForEach-Object { Write-Output ("{0}: Enabled={1}, Entrada={2}" -f $_.Name, $_.Enabled, $_.DefaultInboundAction) }
if (-not (Test-Confirmar)) { Write-Output "Defina CONFIRMAR=true para ativar."; exit 0 }
Set-NetFirewallProfile -Profile Domain, Private, Public -Enabled True -DefaultInboundAction Block
Write-Output "Firewall ativado nos três perfis."
exit 0
