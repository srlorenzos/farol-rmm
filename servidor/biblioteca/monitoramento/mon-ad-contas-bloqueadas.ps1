# ---
# id: mon-ad-contas-bloqueadas
# nome: "Monitor - contas bloqueadas no AD"
# descricao: "Conta contas de usuário bloqueadas no domínio."
# categoria: Monitoramento
# so: [windows]
# shell: powershell
# tipo: monitor
# tempo_limite: 60
# requer_admin: false
# tags: [ad, bloqueio, monitor]
# variaveis:
#   - nome: ALERTA
#     rotulo: "Alerta a partir de"
#     tipo: numero
#     padrao: 3
#     obrigatorio: false
#     opcoes: []
#   - nome: CRITICO
#     rotulo: "Crítico a partir de"
#     tipo: numero
#     padrao: 10
#     obrigatorio: false
#     opcoes: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function Get-Num($v, $padrao) { if ("$v" -match '^\d+$') { [int]$v } else { $padrao } }
function Out-Status($nivel, $msg) { Write-Output "FAROL_STATUS: $nivel $msg" }

if (-not (Get-Module -ListAvailable ActiveDirectory)) { Out-Status 'alerta' 'Módulo ActiveDirectory ausente'; exit 0 }
Import-Module ActiveDirectory
$a = Get-Num $env:FAROL_ALERTA 3; $c = Get-Num $env:FAROL_CRITICO 10
$n = @(Search-ADAccount -LockedOut -UsersOnly).Count
$msg = "$n conta(s) bloqueada(s)"
if ($n -ge $c) { Out-Status 'critico' $msg } elseif ($n -ge $a) { Out-Status 'alerta' $msg } else { Out-Status 'ok' $msg }
exit 0
