# ---
# id: gerenciar-hibernacao
# nome: "Habilitar ou desabilitar hibernação"
# descricao: "Liga ou desliga a hibernação (hiberfil.sys). Desligar libera cerca de 40-75% da RAM em disco e desativa a inicialização rápida."
# categoria: Energia
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 60
# requer_admin: true
# tags: [hibernacao, disco]
# variaveis:
#   - nome: ACAO
#     rotulo: "Ação"
#     tipo: selecao
#     padrao: "status"
#     obrigatorio: true
#     opcoes: [status, desabilitar, habilitar]
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
$f = 'C:\hiberfil.sys'
$ex = Test-Path $f -ErrorAction SilentlyContinue
Write-Output ("Hibernação {0}" -f $(if ($ex -or (Get-Item $f -Force -ErrorAction SilentlyContinue)) { 'habilitada (hiberfil.sys presente)' } else { 'desabilitada' }))
$a = "$env:FAROL_ACAO"
if ($a -notin 'desabilitar', 'habilitar') { exit 0 }
if (-not (Test-Confirmar)) { Write-Output "Defina CONFIRMAR=true para $a."; exit 0 }
powercfg /hibernate $(if ($a -eq 'habilitar') { 'on' } else { 'off' })
Write-Output "Concluído."
exit 0
