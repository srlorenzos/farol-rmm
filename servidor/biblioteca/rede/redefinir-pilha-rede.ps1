# ---
# id: redefinir-pilha-rede
# nome: "Redefinir pilha de rede (winsock/TCP-IP)"
# descricao: "Executa netsh winsock reset e netsh int ip reset para corrigir problemas graves de conectividade. Requer reinício."
# categoria: Rede
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 120
# requer_admin: true
# tags: [winsock, rede, reparo]
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
if (-not (Test-Confirmar)) { Write-Output "Defina CONFIRMAR=true para redefinir a pilha de rede."; exit 0 }
netsh winsock reset
netsh int ip reset
ipconfig /flushdns
Write-Output "Pilha redefinida. REINICIE o computador para concluir."
exit 0
