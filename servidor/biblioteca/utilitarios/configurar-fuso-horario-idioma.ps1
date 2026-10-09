# ---
# id: configurar-fuso-horario-idioma
# nome: "Configurar fuso horário e região"
# descricao: "Define o fuso horário do sistema e mostra o idioma/região atuais."
# categoria: Utilitários
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 60
# requer_admin: true
# tags: [fuso, regiao]
# variaveis:
#   - nome: FUSO
#     rotulo: "Fuso (ex.: E. South America Standard Time)"
#     tipo: texto
#     padrao: "E. South America Standard Time"
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
Write-Output ("Fuso atual: {0}; cultura: {1}" -f (Get-TimeZone).Id, (Get-Culture).Name)
$f = "$env:FAROL_FUSO".Trim()
if (-not (Get-TimeZone -ListAvailable | Where-Object Id -eq $f)) { Write-Output "Fuso inválido. Use tzutil /l para ver os disponíveis."; exit 1 }
if (-not (Test-Confirmar)) { Write-Output "Defina CONFIRMAR=true para aplicar."; exit 0 }
Set-TimeZone -Id $f
Write-Output "Fuso definido."
exit 0
