# ---
# id: recuperacao-automatica-servico
# nome: "Configurar recuperação automática de serviço"
# descricao: "Configura ações de recuperação (reiniciar após falha) de um serviço com sc.exe, para resiliência sem monitoramento externo."
# categoria: Serviços e processos
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 60
# requer_admin: true
# tags: [servicos, resiliencia]
# variaveis:
#   - nome: SERVICO
#     rotulo: "Nome do serviço"
#     tipo: texto
#     padrao: ""
#     obrigatorio: true
#     opcoes: []
#   - nome: ATRASO_SEG
#     rotulo: "Atraso antes de reiniciar (s)"
#     tipo: numero
#     padrao: 30
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
$n = "$env:FAROL_SERVICO".Trim()
if ($n -notmatch '^[\w.$-]+$' -or -not (Get-Service $n -ErrorAction SilentlyContinue)) { Write-Output "Serviço inválido ou inexistente."; exit 1 }
sc.exe qfailure $n
if (-not (Test-Confirmar)) { Write-Output "Defina CONFIRMAR=true para configurar."; exit 0 }
$ms = (Get-Num $env:FAROL_ATRASO_SEG 30) * 1000
sc.exe failure $n reset= 86400 actions= restart/$ms/restart/$ms/restart/$ms | Out-Null
Write-Output "Recuperação configurada: reiniciar após falha em $($ms/1000)s."
exit 0
