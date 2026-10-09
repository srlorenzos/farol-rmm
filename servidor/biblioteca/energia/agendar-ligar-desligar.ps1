# ---
# id: agendar-ligar-desligar
# nome: "Agendar desligamento ou reinício"
# descricao: "Agenda (ou cancela) desligamento/reinício com aviso aos usuários logados."
# categoria: Energia
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 60
# requer_admin: true
# tags: [reinicio, desligar]
# variaveis:
#   - nome: ACAO
#     rotulo: "Ação"
#     tipo: selecao
#     padrao: "reiniciar"
#     obrigatorio: true
#     opcoes: [reiniciar, desligar, cancelar]
#   - nome: MINUTOS
#     rotulo: "Minutos até a ação"
#     tipo: numero
#     padrao: 15
#     obrigatorio: false
#     opcoes: []
#   - nome: MENSAGEM
#     rotulo: "Mensagem aos usuários"
#     tipo: texto
#     padrao: "A TI agendou uma manutenção. Salve seu trabalho."
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
if ("$env:FAROL_ACAO" -eq 'cancelar') { shutdown.exe /a; Write-Output "Agendamento cancelado (se existia)."; exit 0 }
$m = Get-Num $env:FAROL_MINUTOS 15
$msg = ("$env:FAROL_MENSAGEM" -replace '["\r\n]', ' ')
if (-not $msg) { $msg = 'A TI agendou uma manutenção. Salve seu trabalho.' }
if (-not (Test-Confirmar)) { Write-Output "Defina CONFIRMAR=true para agendar $env:FAROL_ACAO em $m min."; exit 0 }
$flag = if ("$env:FAROL_ACAO" -eq 'desligar') { '/s' } else { '/r' }
shutdown.exe $flag /t ($m * 60) /c $msg
Write-Output "Agendado em $m minuto(s)."
exit $LASTEXITCODE
