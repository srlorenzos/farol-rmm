# ---
# id: inventario-hotfix-vs-lista-kb
# nome: "Verificar presença de KBs específicos"
# descricao: "Confere se uma lista de KBs (ex.: patches de vulnerabilidades críticas) está instalada no computador."
# categoria: Inventário e auditoria
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 120
# requer_admin: false
# tags: [patches, kb, compliance]
# variaveis:
#   - nome: KBS
#     rotulo: "KBs separados por vírgula (ex.: KB5034441,KB5034123)"
#     tipo: texto
#     padrao: ""
#     obrigatorio: true
#     opcoes: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

$l = ("$env:FAROL_KBS" -replace '\s', '').ToUpper().Split(',') | Where-Object { $_ -match '^KB\d{6,8}$' }
if (-not $l) { Write-Output "Informe KBs válidos."; exit 1 }
$inst = (Get-HotFix).HotFixID
foreach ($k in $l) { Write-Output ("{0}: {1}" -f $k, $(if ($inst -contains $k) { 'INSTALADO' } else { 'AUSENTE' })) }
exit 0
