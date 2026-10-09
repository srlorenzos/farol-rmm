# ---
# id: desabilitar-inicializacao-rapida
# nome: "Habilitar ou desabilitar inicialização rápida"
# descricao: "Controla o Fast Startup (HiberbootEnabled). Desabilitar resolve problemas de atualização, drivers e Wake-on-LAN."
# categoria: Energia
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 60
# requer_admin: true
# tags: [faststartup, energia]
# variaveis:
#   - nome: ACAO
#     rotulo: "Ação"
#     tipo: selecao
#     padrao: "desabilitar"
#     obrigatorio: true
#     opcoes: [desabilitar, habilitar]
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
$k = 'HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\Power'
Write-Output ("HiberbootEnabled atual: {0}" -f (Get-ItemProperty $k).HiberbootEnabled)
if (-not (Test-Confirmar)) { Write-Output "Defina CONFIRMAR=true para aplicar."; exit 0 }
Set-ItemProperty $k HiberbootEnabled $(if ("$env:FAROL_ACAO" -eq 'habilitar') { 1 } else { 0 }) -Type DWord
Write-Output "Aplicado."
exit 0
