# ---
# id: remover-do-dominio-ou-entra
# nome: "Remover computador do domínio (voltar a workgroup)"
# descricao: "Tira o computador do domínio para o grupo de trabalho informado. Exige credenciais com permissão e confirmação; não reinicia."
# categoria: Onboarding e offboarding
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 180
# requer_admin: true
# tags: [dominio, offboarding]
# variaveis:
#   - nome: USUARIO
#     rotulo: "Conta de domínio (DOMINIO\\usuario)"
#     tipo: texto
#     padrao: ""
#     obrigatorio: true
#     opcoes: []
#   - nome: SENHA
#     rotulo: "Senha"
#     tipo: senha
#     padrao: ""
#     obrigatorio: true
#     opcoes: []
#   - nome: GRUPO_TRABALHO
#     rotulo: "Workgroup"
#     tipo: texto
#     padrao: "WORKGROUP"
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
function Test-Admin { ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator) }
function Exigir-Admin { if (-not (Test-Admin)) { Write-Output 'ERRO: este script precisa ser executado como administrador.'; exit 1 } }
function Test-Confirmar { "$env:FAROL_CONFIRMAR" -match '^(1|true|sim|s|yes|y|verdadeiro)$' }

Exigir-Admin
if (-not (Get-CimInstance Win32_ComputerSystem).PartOfDomain) { Write-Output "Computador não está em domínio."; exit 0 }
$wg = if ("$env:FAROL_GRUPO_TRABALHO" -match '^[A-Za-z0-9-]{1,15}$') { $env:FAROL_GRUPO_TRABALHO } else { 'WORKGROUP' }
if (-not (Test-Confirmar)) { Write-Output "Defina CONFIRMAR=true para sair do domínio."; exit 0 }
$cred = New-Object PSCredential($env:FAROL_USUARIO, (ConvertTo-SecureString $env:FAROL_SENHA -AsPlainText -Force))
Remove-Computer -UnjoinDomainCredential $cred -WorkgroupName $wg -Force -PassThru
Write-Output "Saída do domínio concluída. Reinicie o computador."
exit 0
