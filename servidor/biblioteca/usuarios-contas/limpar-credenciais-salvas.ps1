# ---
# id: limpar-credenciais-salvas
# nome: "Listar e limpar credenciais salvas (cmdkey)"
# descricao: "Lista as credenciais salvas no Gerenciador de Credenciais do usuário atual e remove as de um alvo específico quando informado."
# categoria: Usuários e contas
# so: [windows]
# shell: powershell
# tipo: acao
# tempo_limite: 60
# requer_admin: false
# tags: [credenciais, cmdkey]
# variaveis:
#   - nome: ALVO
#     rotulo: "Alvo a remover (vazio = só listar)"
#     tipo: texto
#     padrao: ""
#     obrigatorio: false
#     opcoes: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

cmdkey /list
$a = "$env:FAROL_ALVO".Trim()
if ($a) {
  if ($a -match '["&|<>]') { Write-Output "Alvo inválido."; exit 1 }
  cmdkey /delete:"$a"
}
exit 0
