# ---
# id: habilitar-compactacao-pasta
# nome: "Compactar pasta com NTFS"
# descricao: "Habilita a compactação NTFS (compact.exe) em uma pasta de dados frios para economizar espaço. Exige confirmação."
# categoria: Disco e armazenamento
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 3600
# requer_admin: true
# tags: [ntfs, compactacao]
# variaveis:
#   - nome: CAMINHO
#     rotulo: "Pasta"
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
function Test-Admin { ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator) }
function Exigir-Admin { if (-not (Test-Admin)) { Write-Output 'ERRO: este script precisa ser executado como administrador.'; exit 1 } }
function Test-Confirmar { "$env:FAROL_CONFIRMAR" -match '^(1|true|sim|s|yes|y|verdadeiro)$' }

Exigir-Admin
$c = "$env:FAROL_CAMINHO".Trim()
if (-not (Test-Path -LiteralPath $c -PathType Container)) { Write-Output "Pasta inválida: $c"; exit 1 }
if ($c -match '^[A-Za-z]:\\?$' -or $c -like "$env:windir*") { Write-Output "Recusado: caminho de sistema."; exit 1 }
if (-not (Test-Confirmar)) { Write-Output "Defina CONFIRMAR=true para compactar $c."; exit 0 }
& compact.exe /C /S:"$c" /I /Q
exit 0
