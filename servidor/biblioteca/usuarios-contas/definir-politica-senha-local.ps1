# ---
# id: definir-politica-senha-local
# nome: "Definir política de senha local"
# descricao: "Configura comprimento mínimo, idade máxima e bloqueio de conta usando net accounts. Mostra a política atual antes de alterar."
# categoria: Usuários e contas
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 60
# requer_admin: true
# tags: [senha, politica, hardening]
# variaveis:
#   - nome: COMPRIMENTO
#     rotulo: "Comprimento mínimo"
#     tipo: numero
#     padrao: 12
#     obrigatorio: false
#     opcoes: []
#   - nome: IDADE_MAX
#     rotulo: "Idade máxima da senha (dias)"
#     tipo: numero
#     padrao: 90
#     obrigatorio: false
#     opcoes: []
#   - nome: TENTATIVAS
#     rotulo: "Tentativas antes do bloqueio"
#     tipo: numero
#     padrao: 5
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
net accounts
$c = Get-Num $env:FAROL_COMPRIMENTO 12; $i = Get-Num $env:FAROL_IDADE_MAX 90; $t = Get-Num $env:FAROL_TENTATIVAS 5
if (-not (Test-Confirmar)) { Write-Output "Aplicaria: mínimo $c, idade máx $i dias, bloqueio após $t tentativas. Defina CONFIRMAR=true."; exit 0 }
net accounts /minpwlen:$c /maxpwage:$i /lockoutthreshold:$t /lockoutduration:30 /lockoutwindow:30
exit $LASTEXITCODE
