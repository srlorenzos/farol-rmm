# ---
# id: definir-impressora-padrao
# nome: "Definir impressora padrão"
# descricao: "Define a impressora padrão do usuário que executa o script."
# categoria: Impressoras
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 60
# requer_admin: false
# tags: [impressoras]
# variaveis:
#   - nome: NOME
#     rotulo: "Nome da impressora"
#     tipo: texto
#     padrao: ""
#     obrigatorio: true
#     opcoes: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

$n = "$env:FAROL_NOME".Trim()
$p = Get-CimInstance Win32_Printer -Filter "Name='$($n -replace "'", "''")'" -ErrorAction SilentlyContinue
if (-not $p) { Write-Output "Impressora não encontrada."; exit 1 }
Invoke-CimMethod -InputObject $p -MethodName SetDefaultPrinter | Out-Null
Write-Output "Padrão: $n"
exit 0
