# ---
# id: limpar-temp
# nome: Limpar arquivos temporários
# descricao: Remove arquivos temporários antigos do Windows e dos perfis de usuário.
# categoria: Manutenção
# so: [windows]            # windows | linux | macos
# shell: powershell        # powershell | cmd | bash | python
# tipo: acao               # acao | monitor | auditoria
# tempo_limite: 300
# requer_admin: true
# tags: [limpeza, disco]
# variaveis:
#   - nome: DIAS
#     rotulo: Apagar arquivos mais antigos que (dias)
#     tipo: numero         # texto | numero | booleano | selecao | senha
#     padrao: 7
#     obrigatorio: false
#     opcoes: []           # para selecao
# ---
$dias = [int]($env:FAROL_DIAS ?? 7)
$limite = (Get-Date).AddDays(-$dias)
Get-ChildItem $env:TEMP -Recurse -Force -ErrorAction SilentlyContinue |
  Where-Object { -not $_.PSIsContainer -and $_.LastWriteTime -lt $limite } |
  Remove-Item -Force -ErrorAction SilentlyContinue
"ok"
