# ---
# id: compliance-contas-sem-senha
# nome: "Compliance - contas locais sem senha"
# descricao: "Identifica contas locais ativas que não exigem senha ou têm senha vazia."
# categoria: Compliance
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

$r = @(Get-LocalUser | Where-Object { $_.Enabled -and -not $_.PasswordRequired })
$ult = Get-LocalUser | Where-Object { $_.Enabled -and -not $_.PasswordLastSet }
if (-not $r -and -not $ult) { Write-Output "Nenhuma conta ativa sem senha exigida."; exit 0 }
($r + $ult) | Select-Object -Unique Name, PasswordRequired, PasswordLastSet | Format-Table -AutoSize | Out-String | Write-Output
Write-Output "ATENÇÃO: contas acima representam risco."
exit 0
