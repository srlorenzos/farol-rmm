# ---
# id: desmapear-unidade-rede
# nome: "Remover unidade de rede mapeada"
# descricao: "Desconecta a letra de unidade de rede informada, ou todas as unidades mapeadas quando TODAS=true."
# categoria: Disco e armazenamento
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 60
# requer_admin: false
# tags: []
# variaveis:
#   - nome: LETRA
#     rotulo: "Letra da unidade"
#     tipo: texto
#     padrao: ""
#     obrigatorio: false
#     opcoes: []
#   - nome: TODAS
#     rotulo: "Remover todas as unidades mapeadas"
#     tipo: booleano
#     padrao: false
#     obrigatorio: false
#     opcoes: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function Test-Sim($v) { "$v" -match '^(1|true|sim|s|yes|y|verdadeiro)$' }

if (Test-Sim $env:FAROL_TODAS) { net use * /delete /y; exit 0 }
$l = "$env:FAROL_LETRA".Trim().TrimEnd(':').ToUpper()
if ($l -notmatch '^[A-Z]$') { Write-Output "Informe LETRA ou TODAS=true."; exit 1 }
net use "${l}:" /delete /y
exit 0
