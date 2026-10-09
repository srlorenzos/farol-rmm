# ---
# id: tamanho-perfis-usuarios
# nome: "Tamanho dos perfis de usuário"
# descricao: "Mostra o espaço usado por cada perfil em C:\\Users com data da última modificação."
# categoria: Disco e armazenamento
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 900
# requer_admin: false
# tags: [perfis, espaco]
# variaveis:
#   - nome: SAIDA
#     rotulo: "Formato de saída"
#     tipo: selecao
#     padrao: "texto"
#     obrigatorio: false
#     opcoes: [texto, json]
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function Out-Dados($d) { if ("$env:FAROL_SAIDA" -eq 'json') { $d | ConvertTo-Json -Depth 4 } else { ($d | Format-Table -AutoSize | Out-String -Width 220).TrimEnd() } }

$d = Get-ChildItem 'C:\Users' -Directory -Force -ErrorAction SilentlyContinue | ForEach-Object {
  $t = (Get-ChildItem -LiteralPath $_.FullName -Recurse -Force -File -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum
  [pscustomobject]@{ Perfil = $_.Name; TamanhoGB = [math]::Round([int64]$t / 1GB, 2); UltimaModificacao = $_.LastWriteTime.ToString('yyyy-MM-dd') }
} | Sort-Object TamanhoGB -Descending
Out-Dados $d
exit 0
