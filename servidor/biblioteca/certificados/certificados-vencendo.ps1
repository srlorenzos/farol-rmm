# ---
# id: certificados-vencendo
# nome: "Certificados vencendo ou vencidos"
# descricao: "Lista certificados de computador e usuário que vencem nos próximos N dias, incluindo já vencidos."
# categoria: Certificados
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 120
# requer_admin: false
# tags: [certificados, vencimento]
# variaveis:
#   - nome: DIAS
#     rotulo: "Vencem em até (dias)"
#     tipo: numero
#     padrao: 60
#     obrigatorio: false
#     opcoes: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function Get-Num($v, $padrao) { if ("$v" -match '^\d+$') { [int]$v } else { $padrao } }

$lim = (Get-Date).AddDays((Get-Num $env:FAROL_DIAS 60))
$r = Get-ChildItem Cert:\LocalMachine\My, Cert:\CurrentUser\My -ErrorAction SilentlyContinue | Where-Object { $_.NotAfter -lt $lim }
if (-not $r) { Write-Output "Nenhum certificado vencido ou vencendo em breve."; exit 0 }
$r | Sort-Object NotAfter | ForEach-Object { Write-Output ("{0}  {1}  {2}" -f $_.NotAfter.ToString('yyyy-MM-dd'), $_.Thumbprint, $_.Subject) }
exit 0
