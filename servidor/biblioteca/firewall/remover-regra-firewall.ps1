# ---
# id: remover-regra-firewall
# nome: "Remover regra de firewall pelo nome"
# descricao: "Remove regras de firewall cujo nome de exibição corresponde exatamente ao informado."
# categoria: Firewall
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 60
# requer_admin: true
# tags: [firewall, regra]
# variaveis:
#   - nome: NOME
#     rotulo: "Nome exato da regra"
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
if (-not $n -or $n -match '[*?]') { Write-Output "Nome inválido (sem curingas)."; exit 1 }
$r = Get-NetFirewallRule -DisplayName $n -ErrorAction SilentlyContinue
if (-not $r) { Write-Output "Regra não encontrada; nada a fazer."; exit 0 }
Write-Output "$(@($r).Count) regra(s) encontrada(s)."
if (-not (Test-Confirmar)) { Write-Output "Defina CONFIRMAR=true para remover."; exit 0 }
$r | Remove-NetFirewallRule
Write-Output "Removida(s)."
exit 0
