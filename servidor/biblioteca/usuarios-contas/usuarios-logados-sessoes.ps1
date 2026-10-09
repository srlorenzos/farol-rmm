# ---
# id: usuarios-logados-sessoes
# nome: "Sessões de usuário ativas"
# descricao: "Lista sessões interativas e RDP (query user) e o usuário do console."
# categoria: Usuários e contas
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 120
# requer_admin: false
# tags: [sessoes, rdp]
# variaveis: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

Write-Output "Usuário do console: $((Get-CimInstance Win32_ComputerSystem).UserName)"
Write-Output ""
$q = query user 2>&1 | Out-String
if ($q -match 'No User|Nenhum usu') { Write-Output "Nenhuma sessão ativa." } else { Write-Output $q.Trim() }
exit 0
