# ---
# id: ad-mover-computador-ou
# nome: "AD - mover computador para outra OU"
# descricao: "Move um objeto computador para a unidade organizacional indicada."
# categoria: Active Directory
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 60
# requer_admin: false
# tags: [ad, ou]
# variaveis:
#   - nome: COMPUTADOR
#     rotulo: "Nome do computador"
#     tipo: texto
#     padrao: ""
#     obrigatorio: true
#     opcoes: []
#   - nome: OU
#     rotulo: "DN da OU de destino"
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
function Test-Confirmar { "$env:FAROL_CONFIRMAR" -match '^(1|true|sim|s|yes|y|verdadeiro)$' }

if (-not (Get-Module -ListAvailable ActiveDirectory)) { Write-Output "Módulo ActiveDirectory não encontrado (instale o RSAT)."; exit 1 }
Import-Module ActiveDirectory
$c = "$env:FAROL_COMPUTADOR".Trim(); $ou = "$env:FAROL_OU".Trim()
if ($c -notmatch '^[A-Za-z0-9-]{1,15}$') { Write-Output "Nome inválido."; exit 1 }
if (-not (Get-ADOrganizationalUnit -Identity $ou -ErrorAction SilentlyContinue)) { Write-Output "OU não encontrada: $ou"; exit 1 }
$obj = Get-ADComputer -Identity $c -ErrorAction Stop
Write-Output "Atual: $($obj.DistinguishedName)`nDestino: $ou"
if (-not (Test-Confirmar)) { Write-Output "Defina CONFIRMAR=true para mover."; exit 0 }
Move-ADObject -Identity $obj.DistinguishedName -TargetPath $ou
Write-Output "Movido."
exit 0
