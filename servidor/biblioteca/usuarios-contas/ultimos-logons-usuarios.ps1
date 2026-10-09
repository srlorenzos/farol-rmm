# ---
# id: ultimos-logons-usuarios
# nome: "Últimos logons por usuário"
# descricao: "Mostra o último logon bem-sucedido de cada perfil local com base no registro de eventos e nos perfis de usuário."
# categoria: Usuários e contas
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 120
# requer_admin: false
# tags: [logon, auditoria]
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

$d = Get-CimInstance Win32_UserProfile | Where-Object { -not $_.Special -and $_.LocalPath -like 'C:\Users\*' } | ForEach-Object {
  [pscustomobject]@{ Perfil = $_.LocalPath; UltimoUso = $_.LastUseTime; Carregado = $_.Loaded }
} | Sort-Object UltimoUso -Descending
Out-Dados $d
exit 0
