# ---
# id: listar-usuarios-locais
# nome: "Listar usuários locais"
# descricao: "Lista contas locais com estado, último logon, expiração de senha e exigência de senha."
# categoria: Usuários e contas
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 120
# requer_admin: false
# tags: [usuarios, contas]
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

$d = Get-LocalUser | ForEach-Object {
  [pscustomobject]@{ Usuario = $_.Name; Ativo = $_.Enabled; UltimoLogon = $_.LastLogon; SenhaExpira = $_.PasswordExpires; SenhaObrigatoria = $_.PasswordRequired; Descricao = $_.Description }
}
Out-Dados $d
exit 0
