# ---
# id: reiniciar-com-aviso
# nome: "Reiniciar o computador com aviso"
# descricao: "Reinicia o computador após um prazo, avisando os usuários logados. Pode ser cancelado com shutdown /a."
# categoria: Utilitários
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 60
# requer_admin: true
# tags: [reinicio]
# variaveis:
#   - nome: MINUTOS
#     rotulo: "Minutos até reiniciar"
#     tipo: numero
#     padrao: 10
#     obrigatorio: false
#     opcoes: []
#   - nome: MOTIVO
#     rotulo: "Texto do aviso"
#     tipo: texto
#     padrao: "Reinício programado pela TI. Salve seu trabalho."
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
$m = Get-Num $env:FAROL_MINUTOS 10
$t = ("$env:FAROL_MOTIVO" -replace '["\r\n]', ' '); if (-not $t) { $t = 'Reinício programado pela TI. Salve seu trabalho.' }
if (-not (Test-Confirmar)) { Write-Output "Defina CONFIRMAR=true para reiniciar em $m minuto(s)."; exit 0 }
shutdown.exe /r /t ($m * 60) /c $t
Write-Output "Reinício em $m minuto(s)."
exit $LASTEXITCODE
