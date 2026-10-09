# ---
# id: ponto-restauracao-sistema
# nome: "Criar ponto de restauração do sistema"
# descricao: "Habilita a Proteção do Sistema em C: (se necessário) e cria um ponto de restauração com descrição. Respeita o limite de 1 ponto por 24 h do Windows."
# categoria: Backup e recuperação
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 300
# requer_admin: true
# tags: [restauracao, snapshot]
# variaveis:
#   - nome: DESCRICAO
#     rotulo: "Descrição"
#     tipo: texto
#     padrao: "Ponto criado pelo Farol"
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
$d = if ("$env:FAROL_DESCRICAO" -match '^[\w .-]{1,80}$') { $env:FAROL_DESCRICAO } else { 'Ponto criado pelo Farol' }
Get-ComputerRestorePoint -ErrorAction SilentlyContinue | Select-Object -Last 3 SequenceNumber, Description, CreationTime | Format-Table | Out-String | Write-Output
if (-not (Test-Confirmar)) { Write-Output "Defina CONFIRMAR=true para criar o ponto."; exit 0 }
Enable-ComputerRestore -Drive "$env:SystemDrive\" -ErrorAction SilentlyContinue
New-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\SystemRestore' -Name SystemRestorePointCreationFrequency -Value 0 -PropertyType DWord -Force | Out-Null
Checkpoint-Computer -Description $d -RestorePointType MODIFY_SETTINGS
Write-Output "Ponto de restauração solicitado."
exit 0
