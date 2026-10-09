# ---
# id: definir-bloqueio-tela-inatividade
# nome: "Definir bloqueio de tela por inatividade"
# descricao: "Configura o tempo limite de inatividade (InactivityTimeoutSecs) para bloquear a sessão automaticamente."
# categoria: Segurança
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 60
# requer_admin: true
# tags: [bloqueio, hardening]
# variaveis:
#   - nome: MINUTOS
#     rotulo: "Minutos de inatividade"
#     tipo: numero
#     padrao: 10
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
if ($m -lt 1 -or $m -gt 120) { Write-Output "Minutos inválidos (1-120)."; exit 1 }
$k = 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System'
Write-Output ("Atual: {0} s" -f (Get-ItemProperty $k).InactivityTimeoutSecs)
if (-not (Test-Confirmar)) { Write-Output "Defina CONFIRMAR=true para definir $m min."; exit 0 }
Set-ItemProperty $k InactivityTimeoutSecs ($m * 60) -Type DWord
Write-Output "Bloqueio por inatividade: $m minuto(s)."
exit 0
