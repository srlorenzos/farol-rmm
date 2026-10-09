# ---
# id: listar-administradores-locais
# nome: "Listar administradores locais"
# descricao: "Lista os membros do grupo Administradores local (incluindo contas de domínio) para revisão de privilégios."
# categoria: Usuários e contas
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 120
# requer_admin: false
# tags: [admin, privilegios]
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

$d = Get-LocalGroupMember -SID 'S-1-5-32-544' | ForEach-Object { [pscustomobject]@{ Conta = $_.Name; Tipo = $_.ObjectClass; Origem = $_.PrincipalSource } }
Out-Dados $d
exit 0
