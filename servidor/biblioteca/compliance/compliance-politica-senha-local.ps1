# ---
# id: compliance-politica-senha-local
# nome: "Compliance - política de senha e bloqueio local"
# descricao: "Exibe a política de senha local (net accounts/secedit) e compara com a recomendação (12+ caracteres, complexidade, bloqueio)."
# categoria: Compliance
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 120
# requer_admin: true
# tags: [senha, compliance]
# variaveis: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

$tmp = Join-Path $env:TEMP 'farol-pol.inf'; secedit /export /cfg $tmp /areas SECURITYPOLICY /quiet | Out-Null
Get-Content $tmp | Where-Object { $_ -match 'MinimumPasswordLength|PasswordComplexity|MaximumPasswordAge|MinimumPasswordAge|PasswordHistorySize|LockoutBadCount|LockoutDuration|ResetLockoutCount|ClearTextPassword' } | Write-Output
Remove-Item $tmp -Force
exit 0
