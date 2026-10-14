# ---
# id: definir-tipo-inicio-servico
# nome: "Alterar tipo de inicialização de serviço"
# descricao: "Define o serviço como Automático, Manual ou Desabilitado, mostrando o valor anterior para possibilitar reversão."
# categoria: Serviços e processos
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 60
# requer_admin: true
# tags: [servicos, configuracao]
# variaveis:
#   - nome: SERVICO
#     rotulo: "Nome do serviço"
#     tipo: texto
#     padrao: ""
#     obrigatorio: true
#     opcoes: []
#   - nome: TIPO
#     rotulo: "Tipo de inicialização"
#     tipo: selecao
#     padrao: "Manual"
#     obrigatorio: true
#     opcoes: [Automatic, Manual, Disabled]
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
$n = "$env:FAROL_SERVICO".Trim()
if ($n -notmatch '^[\w.$-]+$') { Write-Output "Nome inválido."; exit 1 }
if ("$env:FAROL_TIPO" -notin 'Automatic', 'Manual', 'Disabled') { Write-Output "Tipo inválido."; exit 1 }
$s = Get-Service -Name $n -ErrorAction Stop
Write-Output ("{0}: tipo atual = {1}" -f $n, $s.StartType)
if (-not (Test-Confirmar)) { Write-Output "Defina CONFIRMAR=true para alterar para $env:FAROL_TIPO."; exit 0 }
Set-Service -Name $n -StartupType $env:FAROL_TIPO
Write-Output "Alterado para $env:FAROL_TIPO."
exit 0
