# ---
# id: desabilitar-programa-inicializacao
# nome: "Desabilitar programa na inicialização"
# descricao: "Desabilita (sem excluir) um item da inicialização do usuário atual ou da máquina via StartupApproved, de forma reversível."
# categoria: Desempenho
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 60
# requer_admin: false
# tags: [inicializacao]
# variaveis:
#   - nome: NOME
#     rotulo: "Nome do item (como na chave Run)"
#     tipo: texto
#     padrao: ""
#     obrigatorio: true
#     opcoes: []
#   - nome: ESCOPO
#     rotulo: "Escopo"
#     tipo: selecao
#     padrao: "usuario"
#     obrigatorio: false
#     opcoes: [usuario, maquina]
#   - nome: CONFIRMAR
#     rotulo: "Digite true para confirmar a execução"
#     tipo: booleano
#     padrao: false
#     obrigatorio: false
#     opcoes: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function Test-Confirmar { "$env:FAROL_CONFIRMAR" -match '^(1|true|sim|s|yes|y|verdadeiro)$' }

$n = "$env:FAROL_NOME".Trim()
if (-not $n -or $n -match '[\\/]') { Write-Output "Nome inválido."; exit 1 }
$m = "$env:FAROL_ESCOPO" -eq 'maquina'
$k = if ($m) { 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run' } else { 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run' }
$run = if ($m) { 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Run' } else { 'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Run' }
if (-not (Get-ItemProperty $run -Name $n -ErrorAction SilentlyContinue)) { Write-Output "Item '$n' não encontrado em $run"; exit 1 }
if (-not (Test-Confirmar)) { Write-Output "Defina CONFIRMAR=true para desabilitar '$n'."; exit 0 }
if (-not (Test-Path $k)) { New-Item $k -Force | Out-Null }
Set-ItemProperty $k $n ([byte[]](3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0)) -Type Binary
Write-Output "'$n' desabilitado na inicialização (reversível pelo Gerenciador de Tarefas)."
exit 0
