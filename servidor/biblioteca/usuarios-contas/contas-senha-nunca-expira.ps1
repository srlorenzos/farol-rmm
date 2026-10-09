# ---
# id: contas-senha-nunca-expira
# nome: "Contas locais com senha que nunca expira"
# descricao: "Lista contas locais ativas com senha sem expiração ou sem senha obrigatória."
# categoria: Usuários e contas
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 120
# requer_admin: false
# tags: [contas, senha, compliance]
# variaveis: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

$r = Get-LocalUser | Where-Object { $_.Enabled -and (-not $_.PasswordExpires -or -not $_.PasswordRequired) }
if (-not $r) { Write-Output "Todas as contas ativas têm senha com expiração e exigida."; exit 0 }
$r | Select-Object Name, PasswordRequired, PasswordExpires, PasswordLastSet | Format-Table -AutoSize | Out-String | Write-Output
exit 0
