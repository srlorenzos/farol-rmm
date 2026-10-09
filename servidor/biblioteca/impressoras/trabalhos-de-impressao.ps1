# ---
# id: trabalhos-de-impressao
# nome: "Trabalhos de impressão pendentes"
# descricao: "Lista trabalhos na fila de cada impressora com usuário, documento, páginas e estado."
# categoria: Impressoras
# so: [windows]
# shell: powershell
# tipo: auditoria
# tempo_limite: 120
# requer_admin: false
# tags: [fila, impressoras]
# variaveis: []
# ---
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

$j = Get-Printer | ForEach-Object { Get-PrintJob -PrinterName $_.Name -ErrorAction SilentlyContinue }
if (-not $j) { Write-Output "Nenhum trabalho na fila."; exit 0 }
$j | Select-Object PrinterName, ID, UserName, DocumentName, TotalPages, JobStatus, SubmittedTime | Format-Table -AutoSize | Out-String -Width 220 | Write-Output
exit 0
