# ---
# id: imprimir-pagina-teste
# nome: "Imprimir página de teste"
# descricao: "Envia a página de teste do Windows para uma impressora."
# categoria: Impressoras
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 60
# requer_admin: false
# tags: [impressoras, teste]
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
$r = Invoke-CimMethod -InputObject $p -MethodName PrintTestPage
Write-Output "Página de teste enviada (código $($r.ReturnValue))."
exit 0
