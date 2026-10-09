# ---
# id: reparar-repositorio-wmi
# nome: "Verificar e reparar repositório WMI"
# descricao: "Verifica a consistência do repositório WMI e, se inconsistente, tenta salvage. Não reconstrói o repositório sem confirmação."
# categoria: Manutenção
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 300
# requer_admin: true
# tags: [wmi, reparo]
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
$r = & winmgmt.exe /verifyrepository 2>&1 | Out-String
Write-Output $r.Trim()
if ($r -match 'is consistent|consistente') { Write-Output "Repositório WMI consistente."; exit 0 }
if (-not (Test-Confirmar)) { Write-Output "Repositório possivelmente inconsistente. Defina CONFIRMAR=true para executar salvagerepository."; exit 0 }
& winmgmt.exe /salvagerepository
exit 0
