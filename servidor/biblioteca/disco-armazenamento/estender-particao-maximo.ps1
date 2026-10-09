# ---
# id: estender-particao-maximo
# nome: "Estender partição até o máximo disponível"
# descricao: "Estende uma partição para ocupar todo o espaço contíguo não alocado após ela (útil após aumentar o disco virtual)."
# categoria: Disco e armazenamento
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 300
# requer_admin: true
# tags: [particao, expansao]
# variaveis:
#   - nome: UNIDADE
#     rotulo: "Letra da unidade"
#     tipo: texto
#     padrao: "C"
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
function Format-Tam($b) { if ($b -ge 1GB) { '{0:N2} GB' -f ($b / 1GB) } elseif ($b -ge 1MB) { '{0:N1} MB' -f ($b / 1MB) } else { '{0:N0} KB' -f ($b / 1KB) } }
function Test-Confirmar { "$env:FAROL_CONFIRMAR" -match '^(1|true|sim|s|yes|y|verdadeiro)$' }

Exigir-Admin
$u = if ("$env:FAROL_UNIDADE" -match '^[A-Za-z]:?$') { $env:FAROL_UNIDADE.Substring(0,1).ToUpper() } else { 'C' }
$p = Get-Partition -DriveLetter $u -ErrorAction Stop
$max = (Get-PartitionSupportedSize -DriveLetter $u).SizeMax
Write-Output ("Partição {0}: atual {1}, máximo {2}" -f $u, (Format-Tam $p.Size), (Format-Tam $max))
if ($max -le $p.Size + 1MB) { Write-Output "Nada a estender."; exit 0 }
if (-not (Test-Confirmar)) { Write-Output "Defina CONFIRMAR=true para estender."; exit 0 }
Resize-Partition -DriveLetter $u -Size $max
Write-Output "Partição estendida."
exit 0
