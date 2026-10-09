# ---
# id: renomear-computador
# nome: "Renomear computador"
# descricao: "Renomeia o computador (valida o padrão NetBIOS). A alteração só vale após reiniciar."
# categoria: Utilitários
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 60
# requer_admin: true
# tags: [nome, computador]
# variaveis:
#   - nome: NOVO_NOME
#     rotulo: "Novo nome (até 15 caracteres)"
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
$n = "$env:FAROL_NOVO_NOME".Trim()
if ($n -notmatch '^[A-Za-z0-9][A-Za-z0-9-]{0,14}$') { Write-Output "Nome inválido (A-Z, 0-9, hífen, máx. 15)."; exit 1 }
if ($n -eq $env:COMPUTERNAME) { Write-Output "O computador já se chama $n."; exit 0 }
if (-not (Test-Confirmar)) { Write-Output "Renomearia $env:COMPUTERNAME para $n. Defina CONFIRMAR=true."; exit 0 }
Rename-Computer -NewName $n -Force
Write-Output "Renomeado para $n. Reinicie para aplicar (o agente pode perder a identidade de host)."
exit 0
